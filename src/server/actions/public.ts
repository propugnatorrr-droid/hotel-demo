'use server';

import { and, count, eq, gte } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { auditLogs, bookings, conversations, guests, messages, roomTypes } from '@/db/schema';
import { diffDays, formatDay, todayIn } from '@/lib/dates';
import { quoteStay, type Quote } from '@/server/services/stay';
import { bookInput, createWebBookingCore, stayInput } from '@/server/services/web-booking';
import { getPublicOrg, verifyBooking, applyOnlinePayment } from '@/server/services/public-site';
import { ActionError, fail, round2, run, type ActionResult } from './kit';
import { env } from '@/lib/env';
import { localized } from '@/lib/utils';

/* Public, unauthenticated actions for the resort website. Everything is scoped by the
   org resolved from the slug, validated with zod, and rate limited per org. */

export type StayOption = {
  typeId: string;
  available: number;
  total: number;
  perNight: number;
  nights: number;
};
export type SearchResult = { options: StayOption[]; failures: Record<string, string> };

export async function searchStay(input: unknown): Promise<ActionResult<SearchResult>> {
  return run(async () => {
    const p = stayInput.parse(input);
    const pub = await getPublicOrg(p.slug);
    if (!pub) fail('notFound');
    const today = todayIn(pub.org.timezone);
    if (p.checkIn < today) fail('pastDate');
    if (diffDays(p.checkOut, p.checkIn) < 1) fail('nights');
    if (diffDays(p.checkIn, today) > 540) fail('tooFar');

    const types = await db.select({ id: roomTypes.id }).from(roomTypes).where(and(eq(roomTypes.orgId, pub.org.id), eq(roomTypes.isActive, true)));
    const options: StayOption[] = [];
    const failures: Record<string, string> = {};
    for (const t of types) {
      const q: Quote = await quoteStay(db, { orgId: pub.org.id, roomTypeId: t.id, checkIn: p.checkIn, checkOut: p.checkOut, guests: p.adults + p.children });
      if (q.ok) options.push({ typeId: t.id, available: q.available, total: q.total, perNight: round2(q.total / q.nights), nights: q.nights });
      else failures[t.id] = q.reason;
    }
    return { options, failures };
  }, false);
}

export async function createWebBooking(input: unknown): Promise<ActionResult<{ code: string; token: string; redirect: string }>> {
  return run(async () => {
    const p = bookInput.parse(input);
    const pub = await getPublicOrg(p.slug);
    if (!pub) fail('notFound');
    const { code, token, redirect } = await createWebBookingCore(pub, { ...p, source: 'website' });
    return { code, token, redirect };
  });
}

/** Website contact / inquiry form → lands in the unified inbox as a web chat. */
export async function sendInquiry(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const p = z
      .object({
        slug: z.string().max(60),
        name: z.string().trim().min(2).max(100),
        email: z.email().max(160),
        message: z.string().trim().min(5).max(1500),
        locale: z.enum(['sq', 'en']).default('sq'),
        website: z.string().max(0).optional(),
      })
      .parse(input);
    const pub = await getPublicOrg(p.slug);
    if (!pub) fail('notFound');

    const since = new Date(Date.now() - 3_600_000);
    const [recent] = await db
      .select({ n: count() })
      .from(auditLogs)
      .where(and(eq(auditLogs.orgId, pub.org.id), eq(auditLogs.action, 'web.inquiry'), gte(auditLogs.createdAt, since)));
    if ((recent?.n ?? 0) >= 30) fail('busy');

    await db.transaction(async (tx) => {
      const [conv] = await tx
        .insert(conversations)
        .values({
          orgId: pub.org.id,
          channel: 'web_chat',
          externalId: `inq-${crypto.randomUUID()}`,
          contactName: p.name,
          contactHandle: p.email,
          language: p.locale,
          status: 'needs_human',
          unreadCount: 1,
          lastMessagePreview: p.message.slice(0, 120),
        })
        .returning({ id: conversations.id });
      await tx.insert(messages).values({ orgId: pub.org.id, conversationId: conv!.id, direction: 'inbound', author: 'guest', body: p.message });
      await tx.insert(auditLogs).values({ orgId: pub.org.id, action: 'web.inquiry', entityType: 'conversation', entityId: conv!.id, meta: {} });
    });
    return null;
  });
}

/** Demo checkout only: completes a mock payment for a booking the caller holds the signed token for. */
export async function completeMockPayment(input: unknown): Promise<ActionResult<{ redirect: string }>> {
  return run(async () => {
    const p = z.object({ slug: z.string().max(60), code: z.string().max(20), token: z.string().max(40), locale: z.enum(['sq', 'en']).default('sq') }).parse(input);
    if (!verifyBooking(p.code, p.token)) fail('notFound');
    const pub = await getPublicOrg(p.slug);
    if (!pub) fail('notFound');
    const [b] = await db.select().from(bookings).where(and(eq(bookings.orgId, pub.org.id), eq(bookings.code, p.code))).limit(1);
    if (!b) fail('notFound');
    const due = Math.max(0, round2((b.depositAmount || b.totalAmount) - b.paidAmount));
    if (due <= 0) fail('nothingDue');
    const r = await applyOnlinePayment({ orgId: pub.org.id, code: p.code, amount: due, providerRef: `mock-${p.code}-${Math.round(b.paidAmount * 100)}` });
    if (!r.ok) throw new ActionError('notFound');
    const prefix = p.locale === 'en' ? '/en' : '';
    return { redirect: `${prefix}/r/${p.slug}/booking/${p.code}?t=${p.token}&paid=1` };
  });
}

export async function publicTypeName(orgId: string, typeId: string, locale: string) {
  const [t] = await db.select({ name: roomTypes.name }).from(roomTypes).where(and(eq(roomTypes.orgId, orgId), eq(roomTypes.id, typeId))).limit(1);
  return localized(t?.name, locale);
}

