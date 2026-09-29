import 'server-only';

import { and, asc, eq, gt, gte, inArray, lt, ne, sql } from 'drizzle-orm';
import { db } from '@/db';
import { bookings, dailyRates, rooms, roomTypes } from '@/db/schema';
import { addDays, diffDays } from '@/lib/dates';

export const HOLDING_STATUSES = ['tentative', 'confirmed', 'checked_in'] as const;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type Exec = typeof db | Tx;

export type QuoteFailure = 'nights' | 'type' | 'closed' | 'minStay' | 'soldOut' | 'occupancy';
export type QuoteWarning = 'closed' | 'minStay';
export type Quote =
  | {
      ok: true;
      nights: number;
      nightly: { date: string; price: number }[];
      total: number;
      available: number;
      maxOccupancy: number;
      warnings: QuoteWarning[];
    }
  | { ok: false; reason: QuoteFailure; date?: string; minStay?: number };

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Serializes booking writes per room type inside a transaction. */
export async function lockInventory(tx: Tx, orgId: string, roomTypeId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${orgId}:${roomTypeId}`}, 0))`);
}

export async function quoteStay(
  exec: Exec,
  input: {
    orgId: string;
    roomTypeId: string;
    checkIn: string;
    checkOut: string;
    guests?: number;
    excludeBookingId?: string;
    /** false = staff override: closed dates / min stay become warnings */
    enforceRules?: boolean;
  },
): Promise<Quote> {
  const { orgId, roomTypeId, checkIn, checkOut } = input;
  const enforce = input.enforceRules ?? true;
  const warnings: QuoteWarning[] = [];
  const nights = diffDays(checkOut, checkIn);
  if (nights < 1 || nights > 60) return { ok: false, reason: 'nights' };

  const [type] = await exec
    .select({ basePrice: roomTypes.basePrice, maxOccupancy: roomTypes.maxOccupancy })
    .from(roomTypes)
    .where(and(eq(roomTypes.orgId, orgId), eq(roomTypes.id, roomTypeId), eq(roomTypes.isActive, true)))
    .limit(1);
  if (!type) return { ok: false, reason: 'type' };
  if (input.guests && input.guests > type.maxOccupancy) return { ok: false, reason: 'occupancy' };

  const rates = await exec
    .select({ date: dailyRates.date, price: dailyRates.price, minStay: dailyRates.minStay, closed: dailyRates.closed })
    .from(dailyRates)
    .where(
      and(
        eq(dailyRates.orgId, orgId),
        eq(dailyRates.roomTypeId, roomTypeId),
        gte(dailyRates.date, checkIn),
        lt(dailyRates.date, checkOut),
      ),
    );
  const byDate = new Map(rates.map((r) => [r.date, r]));

  const minStay = byDate.get(checkIn)?.minStay ?? 1;
  if (nights < minStay) {
    if (enforce) return { ok: false, reason: 'minStay', minStay };
    warnings.push('minStay');
  }

  const nightly: { date: string; price: number }[] = [];
  for (let i = 0; i < nights; i++) {
    const date = addDays(checkIn, i);
    const rate = byDate.get(date);
    if (rate?.closed) {
      if (enforce) return { ok: false, reason: 'closed', date };
      if (!warnings.includes('closed')) warnings.push('closed');
    }
    nightly.push({ date, price: rate?.price ?? type.basePrice });
  }

  const [sellableRow] = await exec
    .select({ sellable: sql<number>`count(*)`.mapWith(Number) })
    .from(rooms)
    .where(
      and(
        eq(rooms.orgId, orgId),
        eq(rooms.roomTypeId, roomTypeId),
        eq(rooms.isActive, true),
        ne(rooms.status, 'out_of_order'),
      ),
    );

  const overlapping = await exec
    .select({ checkIn: bookings.checkIn, checkOut: bookings.checkOut })
    .from(bookings)
    .where(
      and(
        eq(bookings.orgId, orgId),
        eq(bookings.roomTypeId, roomTypeId),
        inArray(bookings.status, [...HOLDING_STATUSES]),
        lt(bookings.checkIn, checkOut),
        gt(bookings.checkOut, checkIn),
        input.excludeBookingId ? ne(bookings.id, input.excludeBookingId) : undefined,
      ),
    );

  // Peak per-night usage, not a naive overlap count.
  let peak = 0;
  for (const { date } of nightly) {
    const used = overlapping.filter((b) => b.checkIn <= date && b.checkOut > date).length;
    if (used > peak) peak = used;
  }

  const available = (sellableRow?.sellable ?? 0) - peak;
  if (available <= 0) return { ok: false, reason: 'soldOut' };

  return {
    ok: true,
    nights,
    nightly,
    total: round2(nightly.reduce((sum, n) => sum + n.price, 0)),
    available,
    maxOccupancy: type.maxOccupancy,
    warnings,
  };
}

/** Price of a stay from daily_rates with base-price fallback. Ignores availability and rules. */
export async function priceNights(
  exec: Exec,
  input: { orgId: string; roomTypeId: string; checkIn: string; checkOut: string },
) {
  const nights = diffDays(input.checkOut, input.checkIn);
  const [type] = await exec
    .select({ basePrice: roomTypes.basePrice })
    .from(roomTypes)
    .where(and(eq(roomTypes.orgId, input.orgId), eq(roomTypes.id, input.roomTypeId)))
    .limit(1);
  if (!type || nights < 1) return null;
  const rates = await exec
    .select({ date: dailyRates.date, price: dailyRates.price })
    .from(dailyRates)
    .where(
      and(
        eq(dailyRates.orgId, input.orgId),
        eq(dailyRates.roomTypeId, input.roomTypeId),
        gte(dailyRates.date, input.checkIn),
        lt(dailyRates.date, input.checkOut),
      ),
    );
  const byDate = new Map(rates.map((r) => [r.date, r.price]));
  const nightly = Array.from({ length: nights }, (_, i) => {
    const date = addDays(input.checkIn, i);
    return { date, price: byDate.get(date) ?? type.basePrice };
  });
  return { nights, nightly, total: round2(nightly.reduce((sum, n) => sum + n.price, 0)) };
}

function clashSql(orgId: string, checkIn: string, checkOut: string, excludeBookingId?: string) {
  return sql`exists (
    select 1 from bookings b
    where b.org_id = ${orgId}
      and b.room_id = ${rooms.id}
      and b.status in ('tentative','confirmed','checked_in')
      and b.check_in < ${checkOut}
      and b.check_out > ${checkIn}
      ${excludeBookingId ? sql`and b.id <> ${excludeBookingId}` : sql``}
  )`;
}

/** Free rooms of a type, best first: inspected → clean → dirty. */
export async function findFreeRooms(
  exec: Exec,
  input: { orgId: string; roomTypeId: string; checkIn: string; checkOut: string; excludeBookingId?: string },
) {
  return exec
    .select({ id: rooms.id, number: rooms.number, status: rooms.status })
    .from(rooms)
    .where(
      and(
        eq(rooms.orgId, input.orgId),
        eq(rooms.roomTypeId, input.roomTypeId),
        eq(rooms.isActive, true),
        ne(rooms.status, 'out_of_order'),
        sql`not ${clashSql(input.orgId, input.checkIn, input.checkOut, input.excludeBookingId)}`,
      ),
    )
    .orderBy(sql`case ${rooms.status} when 'inspected' then 0 when 'clean' then 1 else 2 end`, asc(rooms.number));
}

export async function roomIsFree(
  exec: Exec,
  input: { orgId: string; roomId: string; checkIn: string; checkOut: string; excludeBookingId?: string },
) {
  const [clash] = await exec
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.orgId, input.orgId),
        eq(bookings.roomId, input.roomId),
        inArray(bookings.status, [...HOLDING_STATUSES]),
        lt(bookings.checkIn, input.checkOut),
        gt(bookings.checkOut, input.checkIn),
        input.excludeBookingId ? ne(bookings.id, input.excludeBookingId) : undefined,
      ),
    )
    .limit(1);
  return !clash;
}
