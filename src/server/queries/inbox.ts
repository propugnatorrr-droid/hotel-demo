import 'server-only';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { bookings, conversations, guests, messageTemplates, messages, profiles } from '@/db/schema';
import type { conversationStatus, messageChannel } from '@/db/schema/enums';
import type { OrgContext } from '@/lib/auth/session';
import { localized } from '@/lib/utils';

export type ConvStatus = (typeof conversationStatus.enumValues)[number];
export type Channel = (typeof messageChannel.enumValues)[number];
export const INBOX_FILTERS = ['all', 'needs_human', 'ai_handling', 'human_handling', 'resolved'] as const;
export type InboxFilter = (typeof INBOX_FILTERS)[number];

export async function listConversations(ctx: OrgContext, filter: InboxFilter) {
  const rows = await db
    .select({
      id: conversations.id,
      channel: conversations.channel,
      contactName: conversations.contactName,
      contactHandle: conversations.contactHandle,
      status: conversations.status,
      unread: conversations.unreadCount,
      lastAt: conversations.lastMessageAt,
      preview: conversations.lastMessagePreview,
      guestId: conversations.guestId,
    })
    .from(conversations)
    .where(and(eq(conversations.orgId, ctx.org.id), filter === 'all' ? sql`${conversations.status} <> 'resolved'` : eq(conversations.status, filter)))
    .orderBy(sql`case ${conversations.status} when 'needs_human' then 0 else 1 end`, desc(conversations.lastMessageAt))
    .limit(120);
  return rows.map((r) => ({ ...r, lastAt: r.lastAt.toISOString() }));
}

export async function getInboxCounts(ctx: OrgContext) {
  const rows = await db
    .select({ status: conversations.status, n: sql<number>`count(*)`.mapWith(Number), unread: sql<number>`coalesce(sum(${conversations.unreadCount}),0)`.mapWith(Number) })
    .from(conversations)
    .where(eq(conversations.orgId, ctx.org.id))
    .groupBy(conversations.status);
  const by = Object.fromEntries(rows.map((r) => [r.status, r.n])) as Partial<Record<ConvStatus, number>>;
  return {
    all: (by.needs_human ?? 0) + (by.ai_handling ?? 0) + (by.human_handling ?? 0),
    needs_human: by.needs_human ?? 0,
    ai_handling: by.ai_handling ?? 0,
    human_handling: by.human_handling ?? 0,
    resolved: by.resolved ?? 0,
  };
}

export async function getThread(ctx: OrgContext, id: string | undefined, locale: string) {
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [c] = await db
    .select({
      id: conversations.id,
      channel: conversations.channel,
      contactName: conversations.contactName,
      contactHandle: conversations.contactHandle,
      status: conversations.status,
      aiEnabled: conversations.aiEnabled,
      language: conversations.language,
      guestId: conversations.guestId,
      bookingId: conversations.bookingId,
      assigneeName: profiles.fullName,
    })
    .from(conversations)
    .leftJoin(profiles, eq(profiles.id, conversations.assignedTo))
    .where(and(eq(conversations.orgId, ctx.org.id), eq(conversations.id, id)))
    .limit(1);
  if (!c) return null;

  const [msgs, tpls, guest] = await Promise.all([
    db
      .select({ id: messages.id, direction: messages.direction, author: messages.author, body: messages.body, attachments: messages.attachments, createdAt: messages.createdAt, aiMeta: messages.aiMeta })
      .from(messages)
      .where(and(eq(messages.orgId, ctx.org.id), eq(messages.conversationId, c.id)))
      .orderBy(asc(messages.createdAt))
      .limit(300),
    db.select().from(messageTemplates).where(and(eq(messageTemplates.orgId, ctx.org.id), eq(messageTemplates.isActive, true))).orderBy(asc(messageTemplates.name)),
    c.guestId
      ? db
          .select({
            id: guests.id, firstName: guests.firstName, lastName: guests.lastName, email: guests.email, phone: guests.phone, isVip: guests.isVip,
            stays: sql<number>`(select count(*) from bookings b where b.guest_id = ${guests.id} and b.status = 'checked_out')`.mapWith(Number),
          })
          .from(guests)
          .where(and(eq(guests.orgId, ctx.org.id), eq(guests.id, c.guestId)))
          .limit(1)
      : Promise.resolve([]),
  ]);

  const booking = c.guestId
    ? (
        await db
          .select({ id: bookings.id, code: bookings.code, checkIn: bookings.checkIn, checkOut: bookings.checkOut, status: bookings.status })
          .from(bookings)
          .where(and(eq(bookings.orgId, ctx.org.id), eq(bookings.guestId, c.guestId)))
          .orderBy(desc(bookings.checkIn))
          .limit(1)
      )[0] ?? null
    : null;

  return {
    ...c,
    messages: msgs.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })),
    templates: tpls.map((t) => ({ id: t.id, name: t.name, body: localized(t.body, c.language === 'en' ? 'en' : locale) })),
    guest: guest[0] ?? null,
    booking,
  };
}

export type ConversationRow = Awaited<ReturnType<typeof listConversations>>[number];
export type Thread = NonNullable<Awaited<ReturnType<typeof getThread>>>;
