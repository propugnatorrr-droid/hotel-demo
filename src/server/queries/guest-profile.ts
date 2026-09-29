import 'server-only';
import { and, desc, eq, inArray, ne, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import {
  auditLogs, bookings, callLogs, conversations, folioItems, folios, guests, invoices, messages, payments, profiles, rooms, roomTypes, spaAppointments, spaServices,
} from '@/db/schema';
import type { OrgContext } from '@/lib/auth/session';
import { addDays, diffDays, todayIn } from '@/lib/dates';
import { localized } from '@/lib/utils';

export type GuestPreferences = {
  room?: string[];
  pillow?: string[];
  dietary?: string[];
  allergies?: string[];
  interests?: string[];
  transport?: string[];
  occasions?: { label: string; date: string }[];
};

export type TimelineItem = {
  id: string;
  at: string;
  kind: 'booking' | 'stay' | 'charge' | 'payment' | 'spa' | 'message' | 'call' | 'invoice' | 'note' | 'profile';
  title: string;
  detail?: string;
  amount?: number;
  href?: string;
  tone?: 'good' | 'bad' | 'neutral' | 'ai';
};

const r2 = (n: number) => Math.round(n * 100) / 100;
const HOLD = ['confirmed', 'checked_in', 'checked_out'];

function mode<T extends string | null | undefined>(list: T[]): T | null {
  const m = new Map<T, number>();
  for (const x of list) if (x) m.set(x, (m.get(x) ?? 0) + 1);
  let best: T | null = null;
  let n = 0;
  for (const [k, v] of m) if (v > n) [best, n] = [k, v];
  return best;
}

/** Everything the hotel knows about one guest, from every department, plus computed intelligence. */
export async function getGuestProfile(ctx: OrgContext, id: string, locale: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const orgId = ctx.org.id;
  const [g] = await db.select().from(guests).where(and(eq(guests.orgId, orgId), eq(guests.id, id))).limit(1);
  if (!g) return null;
  const today = todayIn(ctx.org.timezone);

  const stayRows = await db
    .select({ b: bookings, typeName: roomTypes.name, typeCode: roomTypes.code, room: rooms.number })
    .from(bookings)
    .innerJoin(roomTypes, eq(roomTypes.id, bookings.roomTypeId))
    .leftJoin(rooms, eq(rooms.id, bookings.roomId))
    .where(and(eq(bookings.orgId, orgId), eq(bookings.guestId, id)))
    .orderBy(desc(bookings.checkIn))
    .limit(200);
  const bookingIds = stayRows.map((s) => s.b.id);

  const [charges, pays, spa, convs, invs, notes, events, calls] = await Promise.all([
    bookingIds.length
      ? db
          .select({ id: folioItems.id, type: folioItems.type, description: folioItems.description, amount: folioItems.amount, quantity: folioItems.quantity, postedAt: folioItems.postedAt, bookingId: folios.bookingId })
          .from(folioItems)
          .innerJoin(folios, eq(folios.id, folioItems.folioId))
          .where(and(eq(folios.orgId, orgId), inArray(folios.bookingId, bookingIds)))
          .orderBy(desc(folioItems.postedAt))
          .limit(400)
      : Promise.resolve([]),
    bookingIds.length
      ? db.select().from(payments).where(and(eq(payments.orgId, orgId), inArray(payments.bookingId, bookingIds))).orderBy(desc(payments.receivedAt)).limit(100)
      : Promise.resolve([]),
    db
      .select({ a: spaAppointments, name: spaServices.name })
      .from(spaAppointments)
      .innerJoin(spaServices, eq(spaServices.id, spaAppointments.serviceId))
      .where(and(eq(spaAppointments.orgId, orgId), bookingIds.length ? or(eq(spaAppointments.guestId, id), inArray(spaAppointments.bookingId, bookingIds)) : eq(spaAppointments.guestId, id)))
      .orderBy(desc(spaAppointments.startsAt))
      .limit(60),
    db.select().from(conversations).where(and(eq(conversations.orgId, orgId), eq(conversations.guestId, id))).orderBy(desc(conversations.lastMessageAt)).limit(10),
    db.select().from(invoices).where(and(eq(invoices.orgId, orgId), eq(invoices.guestId, id))).orderBy(desc(invoices.issuedAt)).limit(40),
    db
      .select({ id: auditLogs.id, meta: auditLogs.meta, createdAt: auditLogs.createdAt, userId: auditLogs.userId, author: profiles.fullName })
      .from(auditLogs)
      .leftJoin(profiles, eq(profiles.id, auditLogs.userId))
      .where(and(eq(auditLogs.orgId, orgId), eq(auditLogs.action, 'guest.note'), eq(auditLogs.entityId, id)))
      .orderBy(desc(auditLogs.createdAt))
      .limit(100),
    db
      .select({ id: auditLogs.id, action: auditLogs.action, meta: auditLogs.meta, entityId: auditLogs.entityId, createdAt: auditLogs.createdAt, author: profiles.fullName })
      .from(auditLogs)
      .leftJoin(profiles, eq(profiles.id, auditLogs.userId))
      .where(and(eq(auditLogs.orgId, orgId), bookingIds.length ? or(eq(auditLogs.entityId, id), inArray(auditLogs.entityId, bookingIds)) : eq(auditLogs.entityId, id), ne(auditLogs.action, 'guest.note')))
      .orderBy(desc(auditLogs.createdAt))
      .limit(150),
    bookingIds.length ? db.select().from(callLogs).where(and(eq(callLogs.orgId, orgId), inArray(callLogs.bookingId, bookingIds))).orderBy(desc(callLogs.createdAt)).limit(20) : Promise.resolve([]),
  ]);

  const convIds = convs.map((c) => c.id);
  const msgs = convIds.length
    ? await db.select().from(messages).where(and(eq(messages.orgId, orgId), inArray(messages.conversationId, convIds))).orderBy(desc(messages.createdAt)).limit(120)
    : [];

  /* ───── Intelligence ───── */
  const done = stayRows.filter((s) => s.b.status === 'checked_out' || s.b.status === 'checked_in');
  const valid = stayRows.filter((s) => HOLD.includes(s.b.status));
  const nights = done.reduce((n, s) => n + Math.max(1, diffDays(s.b.checkOut, s.b.checkIn)), 0);
  const roomRevenue = r2(done.reduce((n, s) => n + s.b.totalAmount, 0));
  const extrasByType = new Map<string, number>();
  for (const c of charges) if (c.type !== 'room') extrasByType.set(c.type, r2((extrasByType.get(c.type) ?? 0) + c.amount));
  const spaDirect = spa.filter((s) => s.a.status === 'completed' && !s.a.chargedToFolio).reduce((n, s) => n + s.a.price, 0);
  if (spaDirect) extrasByType.set('spa', r2((extrasByType.get('spa') ?? 0) + spaDirect));
  const extras = r2([...extrasByType.values()].reduce((a, b) => a + b, 0));
  const lifetime = r2(roomRevenue + extras);
  const cancelled = stayRows.filter((s) => s.b.status === 'cancelled').length;
  const noShows = stayRows.filter((s) => s.b.status === 'no_show').length;
  const leadTimes = valid.map((s) => diffDays(s.b.checkIn, s.b.createdAt.toISOString().slice(0, 10))).filter((d) => d >= 0);
  const lastDone = done.find((s) => s.b.checkIn <= today);
  const daysSince = lastDone ? diffDays(today, lastDone.b.checkOut) : null;
  const inHouse = stayRows.find((s) => s.b.status === 'checked_in') ?? null;
  const next = [...stayRows].reverse().find((s) => (s.b.status === 'confirmed' || s.b.status === 'tentative') && s.b.checkIn >= today) ?? null;

  const favType = mode(done.map((s) => localized(s.typeName, locale)));
  const favRoom = mode(done.map((s) => s.room));
  const channel = mode(valid.map((s) => s.b.source));
  const avgChildren = valid.length ? valid.reduce((n, s) => n + s.b.children, 0) / valid.length : 0;
  const avgNights = done.length ? r2(nights / done.length) : 0;
  const directShare = valid.length ? valid.filter((s) => ['direct', 'website', 'whatsapp', 'phone', 'walk_in', 'instagram', 'messenger'].includes(s.b.source)).length / valid.length : 0;

  const stays = done.length;
  const tier = stays >= 8 || lifetime >= 5000 ? 'platinum' : stays >= 4 || lifetime >= 2000 ? 'gold' : stays >= 2 || lifetime >= 600 ? 'silver' : stays >= 1 ? 'bronze' : 'new';
  const segments: string[] = [];
  if (g.isVip) segments.push('vip');
  if (stays >= 2) segments.push('returning');
  if (avgChildren > 0.3) segments.push('family');
  if (avgNights >= 5) segments.push('long_stay');
  if (roomRevenue > 0 && extras / roomRevenue > 0.35) segments.push('big_spender');
  if (valid.length >= 2 && directShare >= 0.6) segments.push('direct_booker');
  if (valid.length >= 2 && directShare < 0.3) segments.push('ota_loyal');
  if (daysSince !== null && daysSince > 365 && stays >= 1 && !next) segments.push('at_risk');
  if (stays === 0 && !next) segments.push('prospect');

  // Heuristic return likelihood (0-100): frequency, recency, satisfaction proxies, channel.
  let score = 25 + Math.min(30, stays * 8) + (directShare >= 0.5 ? 10 : 0) + (g.marketingConsent ? 8 : 0) - noShows * 15 - cancelled * 5;
  if (daysSince !== null) score += daysSince < 120 ? 15 : daysSince < 365 ? 5 : -15;
  if (next) score = 100;
  score = Math.max(0, Math.min(100, Math.round(score)));

  const seasonality = Array.from({ length: 12 }, () => 0);
  for (const s of done) seasonality[Number(s.b.checkIn.slice(5, 7)) - 1]! += Math.max(1, diffDays(s.b.checkOut, s.b.checkIn));

  const itemCounts = new Map<string, { n: number; amount: number; type: string }>();
  for (const c of charges) {
    if (c.type === 'room' || c.amount <= 0) continue;
    const cur = itemCounts.get(c.description) ?? { n: 0, amount: 0, type: c.type };
    itemCounts.set(c.description, { n: cur.n + c.quantity, amount: r2(cur.amount + c.amount), type: c.type });
  }
  const favourites = [...itemCounts.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.n - a.n).slice(0, 8);

  const prefs = (g.preferences ?? {}) as GuestPreferences;
  const completenessFields: [string, boolean][] = [
    ['email', Boolean(g.email)], ['phone', Boolean(g.phone)], ['nationality', Boolean(g.nationality)], ['dateOfBirth', Boolean(g.dateOfBirth)],
    ['document', Boolean(g.documentNumber)], ['address', Boolean(g.city || g.address)], ['language', Boolean(g.language)],
    ['preferences', Object.values(prefs).some((v) => Array.isArray(v) && v.length > 0)], ['consent', g.marketingConsent],
  ];
  const completeness = Math.round((completenessFields.filter(([, ok]) => ok).length / completenessFields.length) * 100);

  let birthday: { date: string; inDays: number; age: number } | null = null;
  if (g.dateOfBirth) {
    const y = Number(today.slice(0, 4));
    let d = `${y}-${g.dateOfBirth.slice(5)}`;
    if (d < today) d = `${y + 1}-${g.dateOfBirth.slice(5)}`;
    birthday = { date: d, inDays: diffDays(d, today), age: Number(d.slice(0, 4)) - Number(g.dateOfBirth.slice(0, 4)) };
  }

  /* ───── Duplicate detection (pain point #1 in hotel CRMs) ───── */
  const digits = (g.phone ?? '').replace(/\D/g, '').slice(-8);
  const conds = [sql`(lower(${guests.firstName}) = lower(${g.firstName}) and lower(${guests.lastName}) = lower(${g.lastName}))`];
  if (g.email) conds.push(sql`lower(${guests.email}) = lower(${g.email})`);
  if (digits.length >= 7) conds.push(sql`right(regexp_replace(coalesce(${guests.phone}, ''), '[^0-9]', '', 'g'), 8) = ${digits}`);
  if (g.documentNumber) conds.push(sql`${guests.documentNumber} = ${g.documentNumber}`);
  const dupRows = await db
    .select({ id: guests.id, firstName: guests.firstName, lastName: guests.lastName, email: guests.email, phone: guests.phone, documentNumber: guests.documentNumber, createdAt: guests.createdAt, stays: sql<number>`(select count(*) from bookings b where b.guest_id = ${guests.id})`.mapWith(Number) })
    .from(guests)
    .where(and(eq(guests.orgId, orgId), ne(guests.id, id), sql`(${sql.join(conds, sql` or `)})`))
    .limit(6);
  const duplicates = dupRows.map((d) => {
    const why: string[] = [];
    if (g.email && d.email?.toLowerCase() === g.email.toLowerCase()) why.push('email');
    if (digits.length >= 7 && (d.phone ?? '').replace(/\D/g, '').slice(-8) === digits) why.push('phone');
    if (g.documentNumber && d.documentNumber === g.documentNumber) why.push('document');
    if (d.firstName.toLowerCase() === g.firstName.toLowerCase() && d.lastName.toLowerCase() === g.lastName.toLowerCase()) why.push('name');
    return { id: d.id, name: `${d.firstName} ${d.lastName}`, email: d.email, phone: d.phone, bookings: d.stays, why, confidence: Math.min(99, why.length * 35 + (why.includes('document') ? 30 : 0)) };
  });

  /* ───── Unified timeline ───── */
  const tl: TimelineItem[] = [];
  const base = '/app/bookings?view=all&b=';
  const typeLabel = (s: (typeof stayRows)[number]) => localized(s.typeName, locale);
  for (const s of stayRows) {
    tl.push({ id: `b-${s.b.id}`, at: s.b.createdAt.toISOString(), kind: 'booking', title: `booking.created|${s.b.code}|${typeLabel(s)}`, detail: `${s.b.checkIn}|${s.b.checkOut}|${s.b.source}`, amount: s.b.totalAmount, href: base + s.b.id });
    if (s.b.checkedInAt) tl.push({ id: `ci-${s.b.id}`, at: s.b.checkedInAt.toISOString(), kind: 'stay', title: `stay.in|${s.room ?? ''}`, href: base + s.b.id, tone: 'good' });
    if (s.b.checkedOutAt) tl.push({ id: `co-${s.b.id}`, at: s.b.checkedOutAt.toISOString(), kind: 'stay', title: `stay.out|${s.room ?? ''}`, href: base + s.b.id });
    if (s.b.cancelledAt) tl.push({ id: `cx-${s.b.id}`, at: s.b.cancelledAt.toISOString(), kind: 'booking', title: `booking.cancelled|${s.b.code}`, detail: s.b.cancelReason ?? '', href: base + s.b.id, tone: 'bad' });
  }
  for (const c of charges) if (c.type !== 'room') tl.push({ id: `c-${c.id}`, at: c.postedAt.toISOString(), kind: 'charge', title: `charge|${c.type}|${c.description}`, amount: c.amount, href: c.bookingId ? base + c.bookingId : undefined, tone: c.amount < 0 ? 'bad' : 'neutral' });
  for (const p of pays) tl.push({ id: `p-${p.id}`, at: p.receivedAt.toISOString(), kind: 'payment', title: `payment|${p.method}|${p.isRefund ? 'refund' : p.isDeposit ? 'deposit' : 'payment'}`, amount: p.isRefund ? -p.amount : p.amount, href: p.bookingId ? base + p.bookingId : undefined, tone: p.isRefund ? 'bad' : 'good' });
  for (const s of spa) tl.push({ id: `s-${s.a.id}`, at: s.a.startsAt.toISOString(), kind: 'spa', title: `spa|${localized(s.name, locale)}|${s.a.status}`, amount: s.a.price, href: '/app/spa' });
  for (const m of msgs.slice(0, 60)) tl.push({ id: `m-${m.id}`, at: m.createdAt.toISOString(), kind: 'message', title: `message|${convs.find((c) => c.id === m.conversationId)?.channel ?? ''}|${m.author}`, detail: m.body.slice(0, 220), href: `/app/inbox?c=${m.conversationId}`, tone: m.author === 'ai' ? 'ai' : 'neutral' });
  for (const c of calls) tl.push({ id: `k-${c.id}`, at: c.createdAt.toISOString(), kind: 'call', title: `call|${c.durationSec}`, detail: c.summary ?? '', href: '/app/voice' });
  for (const i of invs) tl.push({ id: `i-${i.id}`, at: i.issuedAt.toISOString(), kind: 'invoice', title: `invoice|${i.number}|${i.status}`, amount: i.total, href: `/app/invoices?i=${i.id}` });
  for (const n of notes) tl.push({ id: `n-${n.id}`, at: n.createdAt.toISOString(), kind: 'note', title: `note|${n.author ?? ''}`, detail: String((n.meta as { text?: string }).text ?? '') });
  for (const e of events) if (e.action.startsWith('guest.') || e.action.startsWith('checkin.')) tl.push({ id: `e-${e.id}`, at: e.createdAt.toISOString(), kind: 'profile', title: `profile|${e.action}|${e.author ?? ''}` });
  const nowIso = new Date().toISOString();
  const timeline = tl.filter((i) => i.at <= nowIso).sort((a, b) => b.at.localeCompare(a.at));

  return {
    guest: {
      id: g.id, firstName: g.firstName, lastName: g.lastName, email: g.email, phone: g.phone, nationality: g.nationality, language: g.language,
      documentType: g.documentType, documentNumber: g.documentNumber, dateOfBirth: g.dateOfBirth, address: g.address, city: g.city, country: g.country,
      isVip: g.isVip, tags: g.tags, notes: g.notes, marketingConsent: g.marketingConsent, preferences: prefs,
      documentDeleteAfter: g.documentDeleteAfter?.toISOString() ?? null, createdAt: g.createdAt.toISOString(), anonymized: g.firstName === 'Anonim' && !g.email && !g.phone,
    },
    today,
    stats: {
      stays, nights, lifetime, roomRevenue, extras, avgNightly: nights ? r2(roomRevenue / nights) : 0, avgNights, avgSpendPerStay: stays ? r2(lifetime / stays) : 0,
      avgLead: leadTimes.length ? Math.round(leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length) : null,
      cancelled, noShows, bookings: stayRows.length, daysSince, score, tier, segments, favType, favRoom, channel, completeness,
      missing: completenessFields.filter(([, ok]) => !ok).map(([k]) => k),
    },
    spend: [...extrasByType.entries()].map(([type, amount]) => ({ type, amount })).concat(roomRevenue ? [{ type: 'room', amount: roomRevenue }] : []).sort((a, b) => b.amount - a.amount),
    favourites,
    seasonality,
    birthday,
    inHouse: inHouse ? { id: inHouse.b.id, code: inHouse.b.code, room: inHouse.room, checkOut: inHouse.b.checkOut, balance: r2(inHouse.b.totalAmount + charges.filter((c) => c.bookingId === inHouse.b.id && c.type !== 'room').reduce((n, c) => n + c.amount, 0) - inHouse.b.paidAmount) } : null,
    next: next ? { id: next.b.id, code: next.b.code, checkIn: next.b.checkIn, checkOut: next.b.checkOut, room: next.room, type: typeLabel(next), inDays: diffDays(next.b.checkIn, today), paid: next.b.paidAmount, total: next.b.totalAmount } : null,
    stayList: stayRows.map((s) => ({
      id: s.b.id, code: s.b.code, status: s.b.status, source: s.b.source, checkIn: s.b.checkIn, checkOut: s.b.checkOut, nights: Math.max(1, diffDays(s.b.checkOut, s.b.checkIn)),
      type: typeLabel(s), typeCode: s.typeCode, room: s.room, total: s.b.totalAmount, adults: s.b.adults, children: s.b.children,
      extras: r2(charges.filter((c) => c.bookingId === s.b.id && c.type !== 'room').reduce((n, c) => n + c.amount, 0)), requests: s.b.specialRequests,
    })),
    conversations: convs.map((c) => ({ id: c.id, channel: c.channel, status: c.status, lastAt: c.lastMessageAt.toISOString(), preview: c.lastMessagePreview, messages: msgs.filter((m) => m.conversationId === c.id).slice(0, 6).reverse().map((m) => ({ id: m.id, author: m.author, body: m.body, at: m.createdAt.toISOString() })) })),
    notes: notes.map((n) => ({ id: n.id, text: String((n.meta as { text?: string }).text ?? ''), pinned: Boolean((n.meta as { pinned?: boolean }).pinned), author: n.author, mine: n.userId === ctx.user.id, at: n.createdAt.toISOString() })),
    duplicates,
    timeline: timeline.slice(0, 300),
    windowStart: addDays(today, -730),
  };
}

export type GuestProfile = NonNullable<Awaited<ReturnType<typeof getGuestProfile>>>;
