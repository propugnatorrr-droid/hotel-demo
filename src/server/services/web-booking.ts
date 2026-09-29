import 'server-only';
import { and, count, eq, gte } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { auditLogs, bookings, guests } from '@/db/schema';
import { diffDays, formatDay, todayIn } from '@/lib/dates';
import { env } from '@/lib/env';
import { escapeHtml, sendEmail } from '@/lib/integrations/email';
import { createCheckout } from '@/lib/integrations/payments';
import { ActionError, round2 } from '@/server/actions/kit';
import { findFreeRooms, lockInventory, quoteStay } from '@/server/services/stay';
import { queueChannelPush } from '@/server/services/channex-sync';
import { signBooking, type PublicOrg } from '@/server/services/public-site';

export const stayInput = z.object({
  slug: z.string().min(1).max(60),
  checkIn: z.iso.date(),
  checkOut: z.iso.date(),
  adults: z.coerce.number().int().min(1).max(10),
  children: z.coerce.number().int().min(0).max(8),
  locale: z.enum(['sq', 'en']).default('sq'),
});

export const bookInput = stayInput.extend({
  roomTypeId: z.uuid(),
  first: z.string().trim().min(1).max(80),
  last: z.string().trim().min(1).max(80),
  email: z.email().max(160),
  phone: z.string().trim().min(6).max(40),
  requests: z.string().trim().max(600).optional(),
  pay: z.enum(['hotel', 'deposit']).default('hotel'),
  source: z.enum(['website', 'whatsapp', 'instagram', 'messenger', 'phone']).default('website'),
  website: z.string().max(0).optional(), // honeypot
});
export type BookInput = z.infer<typeof bookInput>;

const normalizePhone = (p: string) => p.replace(/[^\d+]/g, '');

function bookingCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `BK-${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')}`;
}

/** Shared by the website booking form and the guest AI chat. Throws ActionError codes. */
export async function createWebBookingCore(pub: PublicOrg, p: BookInput) {
  const { org } = pub;
  const today = todayIn(org.timezone);
  if (p.checkIn < today) throw new ActionError('pastDate');

  const since = new Date(Date.now() - 3_600_000);
  const [recent] = await db
    .select({ n: count() })
    .from(auditLogs)
    .where(and(eq(auditLogs.orgId, org.id), eq(auditLogs.action, 'web.booking'), gte(auditLogs.createdAt, since)));
  if ((recent?.n ?? 0) >= 40) throw new ActionError('busy');

  const created = await db.transaction(async (tx) => {
    await lockInventory(tx, org.id, p.roomTypeId);
    const q = await quoteStay(tx, { orgId: org.id, roomTypeId: p.roomTypeId, checkIn: p.checkIn, checkOut: p.checkOut, guests: p.adults + p.children });
    if (!q.ok) throw new ActionError(q.reason);

    const email = p.email.toLowerCase();
    const phone = normalizePhone(p.phone);
    let [guest] = await tx.select({ id: guests.id }).from(guests).where(and(eq(guests.orgId, org.id), eq(guests.email, email))).limit(1);
    if (!guest) {
      [guest] = await tx
        .insert(guests)
        .values({ orgId: org.id, firstName: p.first, lastName: p.last, email, phone, language: p.locale })
        .returning({ id: guests.id });
    }

    const [free] = await findFreeRooms(tx, { orgId: org.id, roomTypeId: p.roomTypeId, checkIn: p.checkIn, checkOut: p.checkOut });
    const [b] = await tx
      .insert(bookings)
      .values({
        orgId: org.id,
        code: bookingCode(),
        guestId: guest!.id,
        roomTypeId: p.roomTypeId,
        roomId: free?.id ?? null,
        checkIn: p.checkIn,
        checkOut: p.checkOut,
        adults: p.adults,
        children: p.children,
        status: p.pay === 'deposit' ? 'tentative' : 'confirmed',
        source: p.source,
        totalAmount: q.total,
        depositAmount: p.pay === 'deposit' ? round2(Math.min(q.total, Math.max(q.total * 0.3, q.total / q.nights))) : 0,
        currency: org.currency,
        specialRequests: p.requests || null,
      })
      .returning();
    await tx.insert(auditLogs).values({ orgId: org.id, action: 'web.booking', entityType: 'booking', entityId: b!.id, meta: { total: q.total, pay: p.pay, source: p.source } });
    return b!;
  });

  void queueChannelPush(org.id, { availability: true }).catch(() => undefined);
  const token = signBooking(created.code);
  const prefix = p.locale === 'en' ? '/en' : '';
  const detailPath = `${prefix}/r/${org.slug}/booking/${created.code}?t=${token}`;

  let redirect = detailPath;
  if (p.pay === 'deposit') {
    const co = await createCheckout({
      orgId: org.id, slug: org.slug, locale: p.locale, code: created.code, token,
      amount: created.depositAmount, currency: created.currency, description: `${org.name} ${created.code}`, email: p.email,
    });
    redirect = co.url.startsWith(env.NEXT_PUBLIC_APP_URL) ? co.url.slice(env.NEXT_PUBLIC_APP_URL.length) : co.url;
  }

  const sq = p.locale !== 'en';
  void sendEmail({
    orgId: org.id,
    to: p.email,
    subject: sq ? `Rezervimi ${created.code} · ${org.name}` : `Booking ${created.code} · ${org.name}`,
    html: `<div style="font-family:Georgia,serif;max-width:520px;margin:auto;color:#0b1e2d">
      <h1 style="font-weight:400">${escapeHtml(org.name)}</h1>
      <p>${sq ? 'Faleminderit' : 'Thank you'}, ${escapeHtml(p.first)}.</p>
      <p>${formatDay(created.checkIn, p.locale, { day: 'numeric', month: 'long', year: 'numeric' })} → ${formatDay(created.checkOut, p.locale, { day: 'numeric', month: 'long', year: 'numeric' })} · ${diffDays(created.checkOut, created.checkIn)} ${sq ? 'net' : 'nights'}</p>
      <p><b>${created.code}</b></p>
      <p><a href="${env.NEXT_PUBLIC_APP_URL}${detailPath}">${sq ? 'Shiko rezervimin' : 'View booking'}</a></p></div>`,
  });

  return { booking: created, code: created.code, token, redirect };
}
