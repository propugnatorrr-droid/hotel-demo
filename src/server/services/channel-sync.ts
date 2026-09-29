import 'server-only';

import { createHash } from 'node:crypto';
import { and, asc, eq, gt, gte, inArray, like, lt, ne, or } from 'drizzle-orm';
import { unstable_rethrow } from 'next/navigation';
import { after } from 'next/server';
import type { BookingSource } from '@/config/channels';
import { db } from '@/db';
import {
  alerts, auditLogs, bookings, channelEvents, channelMappings, dailyRates, guests,
  integrations, organizations, orgModules, payments, rooms, roomTypes,
} from '@/db/schema';
import { requireOrg } from '@/lib/auth/session';
import { addDays, diffDays, formatDay, todayIn } from '@/lib/dates';
import {
  ChannelError, channexAdapter, mockAdapter, resolveChannelMode,
  type AvailabilityValue, type ChannelAdapter, type ChannelRevision, type PushResult, type RestrictionValue,
} from '@/server/integrations/channel';
import { HOLDING_STATUSES, lockInventory, quoteStay } from './stay';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Booking = typeof bookings.$inferSelect;

const PUSH_DAYS = 365;
const round2 = (n: number) => Math.round(n * 100) / 100;
const escapeLike = (s: string) => s.replace(/[%_\\]/g, '\\$&');
const OTA_LABEL: Partial<Record<BookingSource, string>> = {
  booking_com: 'Booking.com', airbnb: 'Airbnb', expedia: 'Expedia', agoda: 'Agoda', website: 'faqja',
};

class IngestError extends Error {}

function pgCode(e: unknown) {
  const x = e as { code?: string; cause?: { code?: string } };
  return x?.code ?? x?.cause?.code;
}

export function sourceFromOta(name: string): BookingSource {
  const n = name.toLowerCase().replace(/[^a-z]/g, '');
  if (n.includes('booking')) return 'booking_com';
  if (n.includes('airbnb')) return 'airbnb';
  if (n.includes('expedia')) return 'expedia';
  if (n.includes('agoda')) return 'agoda';
  return 'website';
}

/* ───────────────────────── Context ───────────────────────── */

type ChannelContext = {
  integrationId: string;
  adapter: ChannelAdapter;
  effective: 'mock' | 'channex';
  propertyId: string;
  hashes: Record<string, string>;
  config: Record<string, unknown>;
};

async function channelContext(orgId: string): Promise<ChannelContext | null> {
  const [mod] = await db
    .select({ enabled: orgModules.enabled })
    .from(orgModules)
    .where(and(eq(orgModules.orgId, orgId), eq(orgModules.module, 'channel_manager')))
    .limit(1);
  if (!mod?.enabled) return null;

  await db.insert(integrations).values({ orgId, provider: 'channex', mode: 'mock' }).onConflictDoNothing();
  const [integ] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.orgId, orgId), eq(integrations.provider, 'channex')))
    .limit(1);
  if (!integ || !integ.isEnabled) return null;

  const { effective } = resolveChannelMode(integ);
  const key = process.env.CHANNEX_API_KEY;
  const config = integ.config ?? {};
  return {
    integrationId: integ.id,
    effective,
    adapter: effective === 'channex' && key ? channexAdapter(key) : mockAdapter,
    propertyId: integ.externalAccountId ?? 'mock',
    hashes: (config.hashes as Record<string, string> | undefined) ?? {},
    config,
  };
}

/* ───────────────────────── ARI (availability, rates, inventory) ───────────────────────── */

export async function computeAri(orgId: string, from: string, days: number) {
  const to = addDays(from, days);
  const [types, roomRows, held, rates] = await Promise.all([
    db
      .select({ id: roomTypes.id, basePrice: roomTypes.basePrice })
      .from(roomTypes)
      .where(and(eq(roomTypes.orgId, orgId), eq(roomTypes.isActive, true)))
      .orderBy(asc(roomTypes.sortOrder)),
    db
      .select({ roomTypeId: rooms.roomTypeId, status: rooms.status })
      .from(rooms)
      .where(and(eq(rooms.orgId, orgId), eq(rooms.isActive, true))),
    db
      .select({ roomTypeId: bookings.roomTypeId, checkIn: bookings.checkIn, checkOut: bookings.checkOut })
      .from(bookings)
      .where(
        and(
          eq(bookings.orgId, orgId),
          inArray(bookings.status, [...HOLDING_STATUSES]),
          lt(bookings.checkIn, to),
          gt(bookings.checkOut, from),
        ),
      ),
    db
      .select({
        roomTypeId: dailyRates.roomTypeId,
        date: dailyRates.date,
        price: dailyRates.price,
        minStay: dailyRates.minStay,
        closed: dailyRates.closed,
      })
      .from(dailyRates)
      .where(and(eq(dailyRates.orgId, orgId), gte(dailyRates.date, from), lt(dailyRates.date, to))),
  ]);

  const sellable = new Map<string, number>();
  for (const r of roomRows) {
    if (r.status !== 'out_of_order') sellable.set(r.roomTypeId, (sellable.get(r.roomTypeId) ?? 0) + 1);
  }

  // Difference arrays: O(bookings + days) per room type.
  const used = new Map<string, Int32Array>();
  for (const b of held) {
    let arr = used.get(b.roomTypeId);
    if (!arr) {
      arr = new Int32Array(days + 1);
      used.set(b.roomTypeId, arr);
    }
    const s = Math.max(0, diffDays(b.checkIn, from));
    const e = Math.min(days, diffDays(b.checkOut, from));
    if (e > s) {
      arr[s] = (arr[s] ?? 0) + 1;
      arr[e] = (arr[e] ?? 0) - 1;
    }
  }

  const rateMap = new Map(rates.map((r) => [`${r.roomTypeId}:${r.date}`, r]));
  return types.map((t) => {
    const arr = used.get(t.id);
    const total = sellable.get(t.id) ?? 0;
    let running = 0;
    const cells = [];
    for (let i = 0; i < days; i++) {
      running += arr?.[i] ?? 0;
      const date = addDays(from, i);
      const rate = rateMap.get(`${t.id}:${date}`);
      cells.push({
        date,
        available: Math.max(0, total - running),
        price: rate?.price ?? t.basePrice,
        minStay: rate?.minStay ?? 1,
        closed: rate?.closed ?? false,
      });
    }
    return { roomTypeId: t.id, days: cells };
  });
}

/** Collapse consecutive days with identical values into ranges (keeps Channex payloads tiny). */
function toRanges<T extends { date: string }>(cells: T[], key: (c: T) => string) {
  const out: { from: string; to: string; cell: T }[] = [];
  for (const c of cells) {
    const last = out.at(-1);
    if (last && key(last.cell) === key(c) && addDays(last.to, 1) === c.date) last.to = c.date;
    else out.push({ from: c.date, to: c.date, cell: c });
  }
  return out;
}

async function pushTargets(cx: ChannelContext, orgId: string) {
  const map = new Map<string, { room: string; rate: string | null }>();
  if (cx.effective === 'mock') {
    const types = await db
      .select({ id: roomTypes.id })
      .from(roomTypes)
      .where(and(eq(roomTypes.orgId, orgId), eq(roomTypes.isActive, true)));
    for (const t of types) map.set(t.id, { room: t.id, rate: t.id });
    return map;
  }
  const rows = await db
    .select({
      roomTypeId: channelMappings.roomTypeId,
      room: channelMappings.externalRoomId,
      rate: channelMappings.externalRatePlanId,
    })
    .from(channelMappings)
    .where(
      and(
        eq(channelMappings.orgId, orgId),
        eq(channelMappings.provider, 'channex'),
        eq(channelMappings.channel, 'channex'),
        eq(channelMappings.isActive, true),
      ),
    );
  for (const r of rows) if (r.room) map.set(r.roomTypeId, { room: r.room, rate: r.rate });
  return map;
}

async function displayChannels(orgId: string) {
  const rows = await db
    .selectDistinct({ channel: channelMappings.channel })
    .from(channelMappings)
    .where(and(eq(channelMappings.orgId, orgId), eq(channelMappings.isActive, true), ne(channelMappings.channel, 'channex')));
  return rows.map((r) => r.channel);
}

type EventInput = {
  orgId: string;
  direction: 'push' | 'pull';
  kind: string;
  status: 'ok' | 'warning' | 'error';
  summary?: Record<string, unknown>;
  error?: string | null;
  externalId?: string | null;
  bookingId?: string | null;
};

async function logEvent(e: EventInput) {
  const values = {
    orgId: e.orgId,
    provider: 'channex' as const,
    direction: e.direction,
    kind: e.kind,
    status: e.status,
    summary: e.summary ?? {},
    error: e.error ?? null,
    externalId: e.externalId ?? null,
    bookingId: e.bookingId ?? null,
  };
  if (!values.externalId) {
    await db.insert(channelEvents).values(values);
    return;
  }
  await db
    .insert(channelEvents)
    .values(values)
    .onConflictDoUpdate({
      target: [channelEvents.orgId, channelEvents.provider, channelEvents.externalId],
      set: {
        kind: values.kind,
        status: values.status,
        summary: values.summary,
        error: values.error,
        bookingId: values.bookingId,
        updatedAt: new Date(),
      },
    });
}

export type PushKinds = { availability?: boolean; restrictions?: boolean; force?: boolean };
export type PushOutcome = 'ok' | 'warning' | 'skipped' | 'error';

async function send<V>(
  cx: ChannelContext,
  orgId: string,
  kind: 'availability' | 'restrictions',
  values: V[],
  hashes: Record<string, string>,
  force: boolean | undefined,
  summary: Record<string, unknown>,
  fn: (v: V[]) => Promise<PushResult>,
): Promise<PushOutcome> {
  if (values.length === 0) return 'skipped';
  const hash = createHash('sha1').update(JSON.stringify(values)).digest('hex');
  if (!force && hashes[kind] === hash) return 'skipped';

  try {
    const res = await fn(values);
    hashes[kind] = hash;
    const status = res.warnings.length ? 'warning' : 'ok';
    await logEvent({ orgId, direction: 'push', kind, status, summary: { ...summary, ranges: values.length, warnings: res.warnings.slice(0, 5) } });
    await db.update(integrations).set({ lastError: null }).where(eq(integrations.id, cx.integrationId));
    return status;
  } catch (e) {
    const code = e instanceof ChannelError ? e.code : 'unknown';
    if (!(e instanceof ChannelError)) console.error('[channels] push', e);
    await logEvent({ orgId, direction: 'push', kind, status: 'error', error: code, summary: { ...summary, ranges: values.length } });
    await db.update(integrations).set({ lastError: code }).where(eq(integrations.id, cx.integrationId));
    return 'error';
  }
}

/** Push availability and/or rates+restrictions for the next 365 days. Delta-aware via content hash. */
export async function pushAri(orgId: string, kinds: PushKinds = { availability: true }) {
  const cx = await channelContext(orgId);
  if (!cx) return null;
  const [org] = await db.select({ timezone: organizations.timezone }).from(organizations).where(eq(organizations.id, orgId)).limit(1);
  if (!org) return null;

  const today = todayIn(org.timezone);
  const [ari, targets, channels] = await Promise.all([
    computeAri(orgId, today, PUSH_DAYS),
    pushTargets(cx, orgId),
    displayChannels(orgId),
  ]);
  const hashes = { ...cx.hashes };
  const summary = { from: today, to: addDays(today, PUSH_DAYS - 1), types: targets.size, channels };
  const result: { availability?: PushOutcome; restrictions?: PushOutcome } = {};

  if (kinds.availability) {
    const values: AvailabilityValue[] = ari.flatMap((t) => {
      const target = targets.get(t.roomTypeId);
      if (!target) return [];
      return toRanges(t.days, (c) => String(c.available)).map((r) => ({
        property_id: cx.propertyId,
        room_type_id: target.room,
        date_from: r.from,
        date_to: r.to,
        availability: r.cell.available,
      }));
    });
    result.availability = await send(cx, orgId, 'availability', values, hashes, kinds.force, summary, (v) => cx.adapter.pushAvailability(v));
  }

  if (kinds.restrictions) {
    const values: RestrictionValue[] = ari.flatMap((t) => {
      const target = targets.get(t.roomTypeId);
      if (!target?.rate) return [];
      const rate = target.rate;
      return toRanges(t.days, (c) => `${c.price}|${c.minStay}|${c.closed}`).map((r) => ({
        property_id: cx.propertyId,
        rate_plan_id: rate,
        date_from: r.from,
        date_to: r.to,
        ...(r.cell.price > 0 ? { rate: r.cell.price.toFixed(2) } : {}),
        min_stay_arrival: r.cell.minStay,
        stop_sell: r.cell.closed,
      }));
    });
    result.restrictions = await send(cx, orgId, 'restrictions', values, hashes, kinds.force, summary, (v) => cx.adapter.pushRestrictions(v));
  }

  await db
    .update(integrations)
    .set({ config: { ...cx.config, hashes }, lastSyncAt: new Date() })
    .where(eq(integrations.id, cx.integrationId));
  return result;
}

/** Schedule a push after the response is sent. Never throws into the caller. */
export async function queueChannelPush(orgId?: string, kinds: PushKinds = { availability: true }) {
  try {
    const id = orgId ?? (await requireOrg()).org.id;
    after(async () => {
      try {
        await pushAri(id, kinds);
      } catch (e) {
        console.error('[channels] queued push', e);
      }
    });
  } catch (e) {
    unstable_rethrow(e);
    console.error('[channels] queue', e);
  }
}

/* ───────────────────────── Inbound bookings ───────────────────────── */

function bookingCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `BK-${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')}`;
}

async function resolveRoomType(tx: Tx, orgId: string, ext: string | null) {
  if (!ext) return null;
  const [m] = await tx
    .select({ id: channelMappings.roomTypeId })
    .from(channelMappings)
    .where(and(eq(channelMappings.orgId, orgId), eq(channelMappings.externalRoomId, ext), eq(channelMappings.isActive, true)))
    .limit(1);
  if (m) return m.id;
  if (!/^[0-9a-f-]{36}$/i.test(ext)) return null;
  const [t] = await tx
    .select({ id: roomTypes.id })
    .from(roomTypes)
    .where(and(eq(roomTypes.orgId, orgId), eq(roomTypes.id, ext)))
    .limit(1);
  return t?.id ?? null;
}

async function upsertGuest(tx: Tx, orgId: string, rev: ChannelRevision) {
  const c = rev.customer;
  const email = c.email?.trim().toLowerCase() || null;
  const digits = (c.phone ?? '').replace(/[^\d+]/g, '');
  const phone = digits.length >= 6 ? digits : null;

  if (email || phone) {
    const [g] = await tx
      .select({ id: guests.id })
      .from(guests)
      .where(and(eq(guests.orgId, orgId), or(email ? eq(guests.email, email) : undefined, phone ? eq(guests.phone, phone) : undefined)))
      .limit(1);
    if (g) return g.id;
  }
  const [g] = await tx
    .insert(guests)
    .values({
      orgId,
      firstName: (c.firstName || 'Mysafir').slice(0, 80),
      lastName: (c.lastName || '—').slice(0, 80),
      email,
      phone,
      nationality: c.country,
      country: c.country,
      language: c.language ?? 'en',
    })
    .returning({ id: guests.id });
  return g!.id;
}

async function assignFreeRoom(tx: Tx, orgId: string, bookingId: string, roomTypeId: string, checkIn: string, checkOut: string) {
  const candidates = await tx
    .select({ id: rooms.id })
    .from(rooms)
    .where(and(eq(rooms.orgId, orgId), eq(rooms.roomTypeId, roomTypeId), eq(rooms.isActive, true), ne(rooms.status, 'out_of_order')))
    .orderBy(asc(rooms.number));
  if (candidates.length === 0) return null;

  const busy = await tx
    .select({ roomId: bookings.roomId })
    .from(bookings)
    .where(
      and(
        eq(bookings.orgId, orgId),
        inArray(bookings.roomId, candidates.map((c) => c.id)),
        inArray(bookings.status, [...HOLDING_STATUSES]),
        lt(bookings.checkIn, checkOut),
        gt(bookings.checkOut, checkIn),
        ne(bookings.id, bookingId),
      ),
    );
  const taken = new Set(busy.map((b) => b.roomId));
  const free = candidates.find((c) => !taken.has(c.id));
  if (!free) return null;

  try {
    await tx.transaction(async (sp) => {
      await sp.update(bookings).set({ roomId: free.id }).where(and(eq(bookings.orgId, orgId), eq(bookings.id, bookingId)));
    });
    return free.id;
  } catch (e) {
    if (pgCode(e) === '23P01') return null; // lost a race; stays unassigned
    throw e;
  }
}

async function isOverbooked(tx: Tx, orgId: string, roomTypeId: string, checkIn: string, checkOut: string, excludeBookingId?: string) {
  const q = await quoteStay(tx, { orgId, roomTypeId, checkIn, checkOut, excludeBookingId, enforceRules: false });
  return !q.ok && q.reason === 'soldOut';
}

/** Critical alert + the smartest fix: the cheapest better category that is free for those exact dates. */
async function overbookingAlert(
  tx: Tx,
  orgId: string,
  b: { id: string; roomTypeId: string; checkIn: string; checkOut: string },
  guestName: string,
  channel: string,
) {
  const types = await tx
    .select({ id: roomTypes.id, name: roomTypes.name, basePrice: roomTypes.basePrice })
    .from(roomTypes)
    .where(and(eq(roomTypes.orgId, orgId), eq(roomTypes.isActive, true)))
    .orderBy(asc(roomTypes.basePrice));
  const current = types.find((t) => t.id === b.roomTypeId);

  let suggestion: (typeof types)[number] | null = null;
  for (const t of types) {
    if (t.id === b.roomTypeId || (current && t.basePrice < current.basePrice)) continue;
    const q = await quoteStay(tx, { orgId, roomTypeId: t.id, checkIn: b.checkIn, checkOut: b.checkOut, excludeBookingId: b.id, enforceRules: false });
    if (q.ok) {
      suggestion = t;
      break;
    }
  }

  const range = `${formatDay(b.checkIn, 'sq', { day: 'numeric', month: 'short' })} – ${formatDay(b.checkOut, 'sq', { day: 'numeric', month: 'short' })}`;
  await tx.insert(alerts).values({
    orgId,
    type: 'overbooking',
    severity: 'critical',
    title: `Mbirezervim nga ${channel}: ${current?.name.sq ?? ''} · ${range}`,
    body: suggestion
      ? `${guestName} nuk ka dhomë të lirë në këtë kategori. Sugjerim: upgrade falas në ${suggestion.name.sq}, ka vend për këto data.`
      : `${guestName} nuk ka dhomë të lirë dhe asnjë kategori më e lartë nuk është e lirë. Kontaktoni mysafirin ose ${channel} menjëherë.`,
    entityType: 'booking',
    entityId: b.id,
    data: { roomTypeId: b.roomTypeId, suggestedRoomTypeId: suggestion?.id ?? null, checkIn: b.checkIn, checkOut: b.checkOut },
  });
}

async function applyRevision(tx: Tx, orgId: string, rev: ChannelRevision, source: BookingSource) {
  const [org] = await tx.select({ currency: organizations.currency }).from(organizations).where(eq(organizations.id, orgId)).limit(1);
  if (!org) throw new IngestError('notFound');

  const code = (rev.otaCode || rev.id).slice(0, 60);
  const label = OTA_LABEL[source] ?? rev.otaName;
  const guestLabel = `${rev.customer.firstName} ${rev.customer.lastName}`.trim() || label;
  const now = new Date();
  const warnings: string[] = [];
  const bookingIds: string[] = [];

  const existing = await tx
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.orgId, orgId),
        eq(bookings.source, source),
        or(eq(bookings.channelRef, code), like(bookings.channelRef, `${escapeLike(code)}-%`)),
      ),
    )
    .for('update');
  const byRef = new Map(existing.map((b) => [b.channelRef ?? '', b]));

  const cancel = async (b: Booking) => {
    await tx
      .update(bookings)
      .set({ status: 'cancelled', cancelledAt: now, cancelReason: `Anuluar nga ${label}` })
      .where(and(eq(bookings.orgId, orgId), eq(bookings.id, b.id)));
    await tx.insert(auditLogs).values({ orgId, action: 'booking.cancelled', entityType: 'booking', entityId: b.id, meta: { channel: source, revisionId: rev.id } });
    bookingIds.push(b.id);
  };

  if (rev.status === 'cancelled') {
    if (existing.length === 0) warnings.push('cancelUnknown');
    for (const b of existing) {
      if (b.status === 'tentative' || b.status === 'confirmed') await cancel(b);
      else if (b.status === 'checked_in') {
        warnings.push('cancelInHouse');
        bookingIds.push(b.id);
