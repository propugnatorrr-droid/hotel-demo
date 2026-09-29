import 'server-only';
import { and, asc, eq, gt, gte, inArray, lt } from 'drizzle-orm';
import { db } from '@/db';
import { bookings, dailyRates, guests, rooms, roomTypes } from '@/db/schema';
import type { OrgContext } from '@/lib/auth/session';
import { addDays, todayIn } from '@/lib/dates';
import { localized } from '@/lib/utils';

export const CALENDAR_SPANS = [14, 30] as const;

export async function getCalendar(ctx: OrgContext, start: string, days: number, locale: string) {
  const orgId = ctx.org.id;
  const end = addDays(start, days);

  const [types, roomRows, bookingRows, rateRows] = await Promise.all([
    db
      .select({ id: roomTypes.id, code: roomTypes.code, name: roomTypes.name, basePrice: roomTypes.basePrice, maxOccupancy: roomTypes.maxOccupancy })
      .from(roomTypes)
      .where(and(eq(roomTypes.orgId, orgId), eq(roomTypes.isActive, true)))
      .orderBy(asc(roomTypes.sortOrder), asc(roomTypes.code)),
    db
      .select({ id: rooms.id, number: rooms.number, floor: rooms.floor, status: rooms.status, roomTypeId: rooms.roomTypeId })
      .from(rooms)
      .where(and(eq(rooms.orgId, orgId), eq(rooms.isActive, true)))
      .orderBy(asc(rooms.number)),
    db
      .select({
        id: bookings.id,
        code: bookings.code,
        roomId: bookings.roomId,
        roomTypeId: bookings.roomTypeId,
        checkIn: bookings.checkIn,
        checkOut: bookings.checkOut,
        status: bookings.status,
        source: bookings.source,
        adults: bookings.adults,
        children: bookings.children,
        total: bookings.totalAmount,
        paid: bookings.paidAmount,
        createdAt: bookings.createdAt,
        firstName: guests.firstName,
        lastName: guests.lastName,
        isVip: guests.isVip,
      })
      .from(bookings)
      .innerJoin(guests, and(eq(guests.id, bookings.guestId), eq(guests.orgId, orgId)))
      .where(
        and(
          eq(bookings.orgId, orgId),
          inArray(bookings.status, ['tentative', 'confirmed', 'checked_in', 'checked_out']),
          lt(bookings.checkIn, end),
          gt(bookings.checkOut, start),
        ),
      )
      .limit(1500),
    db
      .select({ roomTypeId: dailyRates.roomTypeId, date: dailyRates.date, price: dailyRates.price, minStay: dailyRates.minStay, closed: dailyRates.closed })
      .from(dailyRates)
      .where(and(eq(dailyRates.orgId, orgId), gte(dailyRates.date, start), lt(dailyRates.date, end))),
  ]);

  return {
    today: todayIn(ctx.org.timezone),
    start,
    days,
    types: types.map((t) => ({ id: t.id, code: t.code, name: localized(t.name, locale), basePrice: t.basePrice })),
    rooms: roomRows,
    bookings: bookingRows.map((b) => ({ ...b, createdAt: b.createdAt.toISOString() })),
    rates: rateRows,
  };
}

export type CalendarData = Awaited<ReturnType<typeof getCalendar>>;
