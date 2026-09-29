import 'server-only';

import { and, asc, eq, gt, gte, inArray, lt } from 'drizzle-orm';
import { db } from '@/db';
import { bookings, dailyRates, guests, rooms, roomTypes } from '@/db/schema';
import type { OrgContext } from '@/lib/auth/session';
import { addDays } from '@/lib/dates';
import { HOLDING_STATUSES } from '@/server/services/stay';

const VISIBLE = [...HOLDING_STATUSES, 'checked_out'] as const;
const HOLDING = new Set<string>(HOLDING_STATUSES);

export async function getCalendar(ctx: OrgContext, from: string, days: number) {
  const orgId = ctx.org.id;
  const to = addDays(from, days);

  const [types, roomRows, bookingRows, rateRows] = await Promise.all([
    db
      .select({
        id: roomTypes.id,
        code: roomTypes.code,
        name: roomTypes.name,
        basePrice: roomTypes.basePrice,
        maxOccupancy: roomTypes.maxOccupancy,
      })
      .from(roomTypes)
      .where(and(eq(roomTypes.orgId, orgId), eq(roomTypes.isActive, true)))
      .orderBy(asc(roomTypes.sortOrder), asc(roomTypes.code)),
    db
      .select({ id: rooms.id, number: rooms.number, floor: rooms.floor, status: rooms.status, roomTypeId: rooms.roomTypeId })
      .from(rooms)
      .where(and(eq(rooms.orgId, orgId), eq(rooms.isActive, true))),
    db
      .select({
        id: bookings.id,
        code: bookings.code,
        roomId: bookings.roomId,
        roomTypeId: bookings.roomTypeId,
        roomNumber: rooms.number,
        checkIn: bookings.checkIn,
        checkOut: bookings.checkOut,
        status: bookings.status,
        source: bookings.source,
        adults: bookings.adults,
        children: bookings.children,
        total: bookings.totalAmount,
        paid: bookings.paidAmount,
        firstName: guests.firstName,
        lastName: guests.lastName,
        isVip: guests.isVip,
      })
      .from(bookings)
      .innerJoin(guests, and(eq(guests.id, bookings.guestId), eq(guests.orgId, orgId)))
      .leftJoin(rooms, and(eq(rooms.id, bookings.roomId), eq(rooms.orgId, orgId)))
      .where(
        and(
          eq(bookings.orgId, orgId),
          inArray(bookings.status, [...VISIBLE]),
          lt(bookings.checkIn, to),
          gt(bookings.checkOut, from),
        ),
      )
      .orderBy(asc(bookings.checkIn))
      .limit(2000),
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

  const typeOrder = new Map(types.map((t, i) => [t.id, i]));
  const sortedRooms = roomRows
    .filter((r) => typeOrder.has(r.roomTypeId))
    .sort(
      (a, b) =>
        typeOrder.get(a.roomTypeId)! - typeOrder.get(b.roomTypeId)! ||
        a.number.localeCompare(b.number, undefined, { numeric: true }),
    );

  const sellable = new Map<string, number>();
  for (const r of sortedRooms) {
    if (r.status !== 'out_of_order') sellable.set(r.roomTypeId, (sellable.get(r.roomTypeId) ?? 0) + 1);
  }

  const dates = Array.from({ length: days }, (_, i) => addDays(from, i));
  const rateMap = new Map(rateRows.map((r) => [`${r.roomTypeId}:${r.date}`, r]));
  const holding = bookingRows.filter((b) => HOLDING.has(b.status));

  const inventory = types.map((type) => ({
    roomTypeId: type.id,
    days: dates.map((date) => {
      const rate = rateMap.get(`${type.id}:${date}`);
      const used = holding.filter((b) => b.roomTypeId === type.id && b.checkIn <= date && b.checkOut > date).length;
      return {
        date,
        price: rate?.price ?? type.basePrice,
        minStay: rate?.minStay ?? 1,
        closed: rate?.closed ?? false,
        available: (sellable.get(type.id) ?? 0) - used,
      };
    }),
  }));

  return { orgId, types, rooms: sortedRooms, bookings: bookingRows, inventory };
}

export type CalendarData = Awaited<ReturnType<typeof getCalendar>>;
export type CalendarBooking = CalendarData['bookings'][number];
