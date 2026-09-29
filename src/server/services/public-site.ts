import 'server-only';
import { createHmac } from 'node:crypto';
import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { auditLogs, bookings, orgModules, organizations, outlets, payments, roomTypes, spaServices } from '@/db/schema';
import { localized } from '@/lib/utils';

const key = () => process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'dev-only-secret';
export const signBooking = (code: string) => createHmac('sha256', key()).update(`booking:${code}`).digest('hex').slice(0, 20);
export const verifyBooking = (code: string, token: string) => signBooking(code) === token;

export async function getPublicOrg(slug: string) {
  const [org] = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
  if (!org || org.status === 'suspended') return null;
  const mods = await db.select({ module: orgModules.module, enabled: orgModules.enabled }).from(orgModules).where(eq(orgModules.orgId, org.id));
  const enabled = new Set(mods.filter((m) => m.enabled).map((m) => m.module));
  if (!enabled.has('booking_engine')) return null;
  return { org, modules: enabled };
}

export type PublicOrg = NonNullable<Awaited<ReturnType<typeof getPublicOrg>>>;

export async function getPublicContent(orgId: string, locale: string) {
  const [types, outletRows, spa] = await Promise.all([
    db.select().from(roomTypes).where(and(eq(roomTypes.orgId, orgId), eq(roomTypes.isActive, true))).orderBy(asc(roomTypes.sortOrder), asc(roomTypes.basePrice)),
    db.select().from(outlets).where(and(eq(outlets.orgId, orgId), eq(outlets.isActive, true))).orderBy(asc(outlets.sortOrder)),
    db.select().from(spaServices).where(and(eq(spaServices.orgId, orgId), eq(spaServices.isActive, true))).orderBy(asc(spaServices.sortOrder)),
  ]);
  return {
    types: types.map((t) => ({
      id: t.id,
      code: t.code,
      name: localized(t.name, locale),
      description: localized(t.description, locale),
      basePrice: t.basePrice,
      maxOccupancy: t.maxOccupancy,
      sizeSqm: t.sizeSqm,
      bedType: t.bedType,
      view: t.view,
      amenities: t.amenities,
      images: t.images,
    })),
    outlets: outletRows.filter((o) => o.type !== 'room_service').map((o) => ({ id: o.id, type: o.type, name: localized(o.name, locale), hours: o.openingHours })),
    spa: spa.map((s) => ({ id: s.id, name: localized(s.name, locale), description: localized(s.description, locale), durationMin: s.durationMin, price: s.price })),
  };
}

/** Idempotent: applies a successful online payment to a booking and confirms it. */
export async function applyOnlinePayment(input: { orgId?: string; code: string; amount: number; providerRef: string }) {
  return db.transaction(async (tx) => {
    const [b] = await tx
      .select()
      .from(bookings)
      .where(input.orgId ? and(eq(bookings.orgId, input.orgId), eq(bookings.code, input.code)) : eq(bookings.code, input.code))
      .limit(1)
      .for('update');
    if (!b) return { ok: false as const, reason: 'notFound' };

    const [dup] = await tx.select({ id: payments.id }).from(payments).where(and(eq(payments.orgId, b.orgId), eq(payments.providerRef, input.providerRef))).limit(1);
    if (dup) return { ok: true as const, duplicate: true };

    await tx.insert(payments).values({
      orgId: b.orgId,
      bookingId: b.id,
      amount: input.amount,
      currency: b.currency,
      method: 'online',
      isDeposit: input.amount + b.paidAmount < b.totalAmount - 0.009,
      providerRef: input.providerRef,
      reference: 'Pagesë online',
    });
    await tx
      .update(bookings)
      .set({ paidAmount: sql`${bookings.paidAmount} + ${input.amount}`, ...(b.status === 'tentative' ? { status: 'confirmed' as const } : {}) })
      .where(eq(bookings.id, b.id));
    await tx.insert(auditLogs).values({ orgId: b.orgId, action: 'payment.online', entityType: 'booking', entityId: b.id, meta: { amount: input.amount, providerRef: input.providerRef } });
    return { ok: true as const, duplicate: false };
  });
}
