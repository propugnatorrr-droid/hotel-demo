import 'server-only';
import { and, eq, gte, inArray, like, lt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { auditLogs, bookings, rooms, conversations, guests, messageTemplates, messages, organizations } from '@/db/schema';
import { ADDONS, sizeForRooms } from '@/config/plans';
import { addDays, formatDay, todayIn } from '@/lib/dates';
import { escapeHtml, sendEmail } from '@/lib/integrations/email';
import { sendChannelMessage } from '@/lib/integrations/messaging';
import { getIntegration } from '@/lib/integrations/registry';
import { localized } from '@/lib/utils';

type Org = typeof organizations.$inferSelect;

const RULES = [
  { key: 'pre_arrival', when: (t: string) => ({ status: ['confirmed'] as const, field: 'checkIn' as const, date: addDays(t, 1) }) },
  { key: 'welcome', when: (t: string) => ({ status: ['checked_in'] as const, field: 'checkIn' as const, date: t }) },
  { key: 'review_request', when: (t: string) => ({ status: ['checked_out'] as const, field: 'checkOut' as const, date: t }) },
  { key: 'return_offer', when: (t: string) => ({ status: ['checked_out'] as const, field: 'checkOut' as const, date: addDays(t, -30) }) },
] as const;

const fill = (body: string, vars: Record<string, string>) => body.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? '');

/** Guest journey: pre-arrival, welcome, review request, return offer. Idempotent per booking + step. */
export async function runJourney(org: Org) {
  const today = todayIn(org.timezone);
  const tpls = await db.select().from(messageTemplates).where(and(eq(messageTemplates.orgId, org.id), eq(messageTemplates.isActive, true)));
  const wa = await getIntegration(org.id, 'meta_whatsapp');
  const reviewLink = typeof org.settings.reviewLink === 'string' ? org.settings.reviewLink : '';
  let sent = 0;

  // WhatsApp template messages cost us money: enforce the plan's monthly quota, then fall back to free email.
  const [roomCount] = await db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(rooms).where(and(eq(rooms.orgId, org.id), eq(rooms.isActive, true)));
  const size = sizeForRooms(roomCount?.n ?? 0);
  const quota = size === 'enterprise' ? Infinity : ADDONS.whatsapp.includedMessages[size];
  const monthStart = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
  const [used] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(auditLogs)
    .where(and(eq(auditLogs.orgId, org.id), like(auditLogs.action, 'journey.%'), sql`${auditLogs.meta}->>'via' = 'whatsapp'`, gte(auditLogs.createdAt, monthStart)));
  let waUsed = used?.n ?? 0;

  for (const rule of RULES) {
    const tpl = tpls.find((t) => t.key === rule.key);
    if (!tpl) continue;
    const w = rule.when(today);
    const rows = await db
      .select({ b: bookings, g: guests })
      .from(bookings)
      .innerJoin(guests, eq(guests.id, bookings.guestId))
      .where(and(eq(bookings.orgId, org.id), inArray(bookings.status, [...w.status]), eq(w.field === 'checkIn' ? bookings.checkIn : bookings.checkOut, w.date)))
      .limit(300);

    for (const { b, g } of rows) {
      const [done] = await db
        .select({ id: auditLogs.id })
        .from(auditLogs)
        .where(and(eq(auditLogs.orgId, org.id), eq(auditLogs.action, `journey.${rule.key}`), eq(auditLogs.entityId, b.id)))
        .limit(1);
      if (done || g.tags.includes('channel')) continue;

      const lang = g.language === 'en' ? 'en' : 'sq';
      const text = fill(localized(tpl.body, lang), {
        name: g.firstName,
        check_in: formatDay(b.checkIn, lang, { day: 'numeric', month: 'long' }),
        review_link: reviewLink,
      });

      const viaWhatsapp = Boolean(g.phone) && wa.mode !== 'mock' && wa.enabled && waUsed < quota;
      let ok = false;
      if (viaWhatsapp) {
        const to = g.phone!.replace(/[^\d]/g, '');
        const res = await sendChannelMessage({ orgId: org.id, channel: 'whatsapp', to, text });
        ok = res.ok;
        if (ok) {
          let [conv] = await db.select().from(conversations).where(and(eq(conversations.orgId, org.id), eq(conversations.channel, 'whatsapp'), eq(conversations.externalId, to))).limit(1);
          if (!conv) [conv] = await db.insert(conversations).values({ orgId: org.id, channel: 'whatsapp', externalId: to, contactName: `${g.firstName} ${g.lastName}`, contactHandle: `+${to}`, guestId: g.id, bookingId: b.id, language: lang }).returning();
          if (conv) {
            await db.insert(messages).values({ orgId: org.id, conversationId: conv.id, direction: 'outbound', author: 'system', body: text, deliveredAt: new Date() });
            await db.update(conversations).set({ lastMessageAt: new Date(), lastMessagePreview: text.slice(0, 120) }).where(eq(conversations.id, conv.id));
          }
        }
      } else if (g.email) {
        const r = await sendEmail({ orgId: org.id, to: g.email, subject: `${org.name}`, html: `<div style="font-family:Georgia,serif;max-width:520px;margin:auto;color:#0b1e2d"><h2 style="font-weight:400">${escapeHtml(org.name)}</h2><p>${escapeHtml(text)}</p></div>` });
        ok = r.ok;
      }
      if (ok) {
        sent++;
        if (viaWhatsapp) waUsed++;
        await db.insert(auditLogs).values({ orgId: org.id, action: `journey.${rule.key}`, entityType: 'booking', entityId: b.id, meta: { via: viaWhatsapp ? 'whatsapp' : 'email' } });
      }
    }
  }

  // Deposit never paid: release tentative website bookings after 24h.
  const stale = await db
    .update(bookings)
    .set({ status: 'cancelled', cancelledAt: new Date(), cancelReason: 'Paradhënia nuk u pagua brenda 24 orësh' })
    .where(and(eq(bookings.orgId, org.id), eq(bookings.status, 'tentative'), eq(bookings.source, 'website'), lt(bookings.createdAt, sql`now() - interval '24 hours'`), sql`${bookings.paidAmount} = 0`))
    .returning({ id: bookings.id });

  return { sent, released: stale.length };
}
