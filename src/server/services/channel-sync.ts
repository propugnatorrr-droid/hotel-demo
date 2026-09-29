import 'server-only';
import { and, eq, gt, gte, inArray, like, lt, ne, sql } from 'drizzle-orm';
import { db } from '@/db';
import { alerts, auditLogs, bookings, channelMappings, dailyRates, guests, rooms, roomTypes } from '@/db/schema';
import { addDays, todayIn } from '@/lib/dates';
import { assertPublicFeedUrl, parseIcs } from '@/lib/integrations/ical';
import { getIntegration, markSync } from '@/lib/integrations/registry';
import { findFreeRooms, HOLDING_STATUSES, lockInventory, priceNights } from '@/server/services/stay';

export type SyncResult = { created: number; updated: number; cancelled: number; conflicts: number; error?: string };

const CHANNEL_SOURCE = { booking_com: 'booking_com', airbnb: 'airbnb', expedia: 'expedia', agoda: 'agoda' } as const;
type Channel = keyof typeof CHANNEL_SOURCE;
const LABEL: Record<Channel, string> = { booking_com: 'Booking.com', airbnb: 'Airbnb', expedia: 'Expedia', agoda: 'Agoda' };

function bookingCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `BK-${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')}`;
}

async function channelGuest(orgId: string, channel: Channel) {
  const lastName = `(${LABEL[channel]})`;
  const [existing] = await db
    .select({ id: guests.id })
    .from(guests)
    .where(and(eq(guests.orgId, orgId), eq(guests.firstName, 'Mysafir'), eq(guests.lastName, lastName)))
    .limit(1);
  if (existing) return existing.id;
  const [g] = await db
    .insert(guests)
    .values({ orgId, firstName: 'Mysafir', lastName, tags: ['channel'], notes: 'Krijuar automatikisht nga sinkronizimi iCal.' })
    .returning({ id: guests.id });
  return g!.id;
}

/** Pulls one OTA iCal feed and reconciles it with our bookings. Safe to run repeatedly. */
export async function syncIcalMapping(orgId: string, mappingId: string, timezone: string, currency: 'ALL' | 'EUR' | 'USD'): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, cancelled: 0, conflicts: 0 };
  const [m] = await db
    .select()
    .from(channelMappings)
    .where(and(eq(channelMappings.orgId, orgId), eq(channelMappings.id, mappingId)))
    .limit(1);
  if (!m || !m.icalImportUrl || !(m.channel in CHANNEL_SOURCE)) return { ...result, error: 'no_feed' };
  const channel = m.channel as Channel;
  const source = CHANNEL_SOURCE[channel];
  const today = todayIn(timezone);
  const prefix = `ical:${m.id}:`;

  try {
    const ical = await getIntegration(orgId, 'ical');
    if (!ical.enabled) return { ...result, error: 'disabled' };
    const url = assertPublicFeedUrl(m.icalImportUrl);
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: { 'User-Agent': 'Iliria-iCal-Sync/1.0' }, redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = (await res.text()).slice(0, 4_000_000);
    const events = parseIcs(text).filter((e) => e.end > today && e.start < addDays(today, 800));
    const live = events.filter((e) => !e.cancelled);
    const liveUids = new Set(live.map((e) => e.uid));

    const existing = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.orgId, orgId), like(bookings.channelRef, `${prefix}%`)));
    const byRef = new Map(existing.map((b) => [b.channelRef!, b]));
    const guestId = await channelGuest(orgId, channel);

    for (const e of live) {
      const ref = `${prefix}${e.uid}`;
      const cur = byRef.get(ref);
      if (cur) {
        if (['cancelled', 'checked_out', 'no_show'].includes(cur.status)) continue;
        if (cur.checkIn !== e.start || cur.checkOut !== e.end) {
          await db.transaction(async (tx) => {
            await lockInventory(tx, orgId, m.roomTypeId);
            if (cur.roomId) {
              const free = await findFreeRooms(tx, { orgId, roomTypeId: m.roomTypeId, checkIn: e.start, checkOut: e.end, excludeBookingId: cur.id });
              const stillOk = free.some((r) => r.id === cur.roomId);
              if (!stillOk) {
                result.conflicts++;
                await tx.insert(alerts).values({
                  orgId, type: 'channel_conflict', severity: 'critical',
                  title: `${LABEL[channel]}: datat ndryshuan dhe dhoma nuk është më e lirë`,
                  body: `${cur.code} · ${e.start} → ${e.end}`, entityType: 'booking', entityId: cur.id,
                });
                return;
              }
            }
            await tx.update(bookings).set({ checkIn: e.start, checkOut: e.end }).where(eq(bookings.id, cur.id));
            result.updated++;
          });
        }
        continue;
      }

      await db.transaction(async (tx) => {
        await lockInventory(tx, orgId, m.roomTypeId);
        const free = await findFreeRooms(tx, { orgId, roomTypeId: m.roomTypeId, checkIn: e.start, checkOut: e.end });
        const price = await priceNights(tx, { orgId, roomTypeId: m.roomTypeId, checkIn: e.start, checkOut: e.end });
        const [created] = await tx
          .insert(bookings)
          .values({
            orgId, code: bookingCode(), guestId, roomTypeId: m.roomTypeId, roomId: free[0]?.id ?? null,
            checkIn: e.start, checkOut: e.end, adults: 2, children: 0, status: 'confirmed', source,
            channelRef: ref, totalAmount: price?.total ?? 0, currency, notes: e.summary,
          })
          .returning({ id: bookings.id, code: bookings.code });
        result.created++;
        if (free.length === 0) {
          result.conflicts++;
          await tx.insert(alerts).values({
            orgId, type: 'overbooking', severity: 'critical',
            title: `Mbi-rezervim nga ${LABEL[channel]}: nuk ka dhomë të lirë`,
            body: `${created!.code} · ${e.start} → ${e.end}. Cakto një dhomë ose lëviz një rezervim.`,
            entityType: 'booking', entityId: created!.id,
          });
        }
      });
    }

    // Reservations that disappeared from the feed were cancelled on the OTA side.
    for (const cur of existing) {
      const uid = cur.channelRef!.slice(prefix.length);
      if (liveUids.has(uid)) continue;
      if (!['tentative', 'confirmed'].includes(cur.status) || cur.checkOut <= today) continue;
      await db.update(bookings).set({ status: 'cancelled', cancelledAt: new Date(), cancelReason: `${LABEL[channel]} iCal: u hoq nga kalendari` }).where(eq(bookings.id, cur.id));
      result.cancelled++;
    }

    await db.update(channelMappings).set({ lastSyncAt: new Date() }).where(eq(channelMappings.id, m.id));
    await markSync(orgId, 'ical', null);
    await db.insert(auditLogs).values({ orgId, action: 'channel.sync', entityType: 'channel_mapping', entityId: m.id, meta: { channel, ...result } });
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : 'sync failed';
    await markSync(orgId, 'ical', message);
    await db.insert(auditLogs).values({ orgId, action: 'channel.sync_failed', entityType: 'channel_mapping', entityId: m.id, meta: { channel, error: message } });
    return { ...result, error: message };
  }
}

export type AvailabilityRow = { roomTypeId: string; date: string; available: number; price: number; minStay: number; closed: boolean };

/** Availability + rates for the next `days` days, the payload every channel manager wants. */
export async function computeAvailability(orgId: string, from: string, days: number): Promise<AvailabilityRow[]> {
  const to = addDays(from, days);
  const [types, roomRows, held, rates] = await Promise.all([
    db.select({ id: roomTypes.id, basePrice: roomTypes.basePrice }).from(roomTypes).where(and(eq(roomTypes.orgId, orgId), eq(roomTypes.isActive, true))),
    db
      .select({ typeId: rooms.roomTypeId, n: sql<number>`count(*)`.mapWith(Number) })
      .from(rooms)
      .where(and(eq(rooms.orgId, orgId), eq(rooms.isActive, true), ne(rooms.status, 'out_of_order')))
      .groupBy(rooms.roomTypeId),
    db
      .select({ typeId: bookings.roomTypeId, checkIn: bookings.checkIn, checkOut: bookings.checkOut })
      .from(bookings)
      .where(and(eq(bookings.orgId, orgId), inArray(bookings.status, [...HOLDING_STATUSES]), lt(bookings.checkIn, to), gt(bookings.checkOut, from))),
    db.select().from(dailyRates).where(and(eq(dailyRates.orgId, orgId), gte(dailyRates.date, from), lt(dailyRates.date, to))),
  ]);
  const sellable = new Map(roomRows.map((r) => [r.typeId, r.n]));
  const rateBy = new Map(rates.map((r) => [`${r.roomTypeId}|${r.date}`, r]));
  const out: AvailabilityRow[] = [];
  for (const t of types) {
    const mine = held.filter((h) => h.typeId === t.id);
    for (let i = 0; i < days; i++) {
      const date = addDays(from, i);
      const used = mine.filter((h) => h.checkIn <= date && h.checkOut > date).length;
      const r = rateBy.get(`${t.id}|${date}`);
      out.push({ roomTypeId: t.id, date, available: Math.max(0, (sellable.get(t.id) ?? 0) - used), price: r?.price ?? t.basePrice, minStay: r?.minStay ?? 1, closed: r?.closed ?? false });
    }
  }
  return out;
}

/** Pushes availability and rates to Channex. mock = compute and report only; sandbox/live = real HTTP. */
export async function pushChannel(orgId: string, days = 180): Promise<{ mode: string; rows: number; pushed: boolean; error?: string }> {
  const integ = await getIntegration(orgId, 'channex');
  const rows = await computeAvailability(orgId, todayIn('Europe/Tirane'), days);
  if (integ.mode === 'mock' || !integ.enabled) {
    await markSync(orgId, 'channex', null);
    await db.insert(auditLogs).values({ orgId, action: 'channel.push', entityType: 'channex', meta: { mode: 'mock', rows: rows.length } });
    return { mode: 'mock', rows: rows.length, pushed: false };
  }

  const base = process.env.CHANNEX_BASE_URL || 'https://staging.channex.io/api/v1';
  const key = process.env.CHANNEX_API_KEY;
  if (!key) return { mode: integ.mode, rows: rows.length, pushed: false, error: 'CHANNEX_API_KEY missing' };
  const maps = await db.select().from(channelMappings).where(and(eq(channelMappings.orgId, orgId), eq(channelMappings.provider, 'channex'), eq(channelMappings.isActive, true)));
  const propertyId = String(integ.config.propertyId ?? '');
  if (!propertyId || maps.length === 0) return { mode: integ.mode, rows: rows.length, pushed: false, error: 'not_mapped' };

  try {
    const availability: unknown[] = [];
    const restrictions: unknown[] = [];
    for (const map of maps) {
      if (!map.externalRoomId) continue;
      for (const r of rows.filter((x) => x.roomTypeId === map.roomTypeId)) {
        availability.push({ property_id: propertyId, room_type_id: map.externalRoomId, date_from: r.date, date_to: r.date, availability: r.closed ? 0 : r.available });
        if (map.externalRatePlanId) {
          restrictions.push({ property_id: propertyId, rate_plan_id: map.externalRatePlanId, date_from: r.date, date_to: r.date, rate: r.price.toFixed(2), min_stay_arrival: r.minStay, stop_sell: r.closed });
        }
      }
    }
    for (const [path, values] of [['availability', availability], ['restrictions', restrictions]] as const) {
      for (let i = 0; i < values.length; i += 500) {
        const res = await fetch(`${base}/${path}`, {
          method: 'POST',
          headers: { 'user-api-key': key, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: values.slice(i, i + 500) }),
          signal: AbortSignal.timeout(20_000),
        });
        if (!res.ok) throw new Error(`Channex ${path} ${res.status}`);
      }
    }
    await markSync(orgId, 'channex', null);
    await db.insert(auditLogs).values({ orgId, action: 'channel.push', entityType: 'channex', meta: { mode: integ.mode, rows: availability.length } });
    return { mode: integ.mode, rows: availability.length, pushed: true };
  } catch (e) {
    const error = e instanceof Error ? e.message : 'push failed';
    await markSync(orgId, 'channex', error);
    return { mode: integ.mode, rows: rows.length, pushed: false, error };
  }
}
