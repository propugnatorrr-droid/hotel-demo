import 'server-only';

import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  bookings,
  folioItems,
  folios,
  guests,
  rooms,
  roomTypes,
} from '@/db/schema';
import type { OrgContext } from '@/lib/auth/session';

export async function getFrontDesk(ctx: OrgContext) {
  const orgId = ctx.org.id;

  const [bookingRows, guestRows, roomRows] = await Promise.all([
    db
      .select({
        id: bookings.id,
        code: bookings.code,
        groupId: bookings.groupId,
        guestId: bookings.guestId,
        guestFirst: guests.firstName,
        guestLast: guests.lastName,
        roomId: bookings.roomId,
        roomNumber: rooms.number,
        checkIn: bookings.checkIn,
        checkOut: bookings.checkOut,
        adults: bookings.adults,
        children: bookings.children,
        status: bookings.status,
        source: bookings.source,
        totalAmount: bookings.totalAmount,
        currency: bookings.currency,
        specialRequests: bookings.specialRequests,
        createdAt: bookings.createdAt,
      })
      .from(bookings)
      .innerJoin(guests, and(eq(guests.id, bookings.guestId), eq(guests.orgId, orgId)))
      .leftJoin(rooms, and(eq(rooms.id, bookings.roomId), eq(rooms.orgId, orgId)))
      .where(eq(bookings.orgId, orgId))
      .orderBy(desc(bookings.checkIn), desc(bookings.createdAt))
      .limit(300),

    // Do not send document numbers or other ID data to the list UI.
    db
      .select({
        id: guests.id,
        firstName: guests.firstName,
        lastName: guests.lastName,
        email: guests.email,
        phone: guests.phone,
        nationality: guests.nationality,
        isVip: guests.isVip,
        notes: guests.notes,
        marketingConsent: guests.marketingConsent,
        createdAt: guests.createdAt,
      })
      .from(guests)
      .where(eq(guests.orgId, orgId))
      .orderBy(asc(guests.lastName), asc(guests.firstName))
      .limit(500),

    db
      .select({
        id: rooms.id,
        number: rooms.number,
        status: rooms.status,
        isActive: rooms.isActive,
        roomTypeId: rooms.roomTypeId,
        roomTypeName: roomTypes.name,
        basePrice: roomTypes.basePrice,
        maxOccupancy: roomTypes.maxOccupancy,
      })
      .from(rooms)
      .innerJoin(
        roomTypes,
        and(eq(roomTypes.id, rooms.roomTypeId), eq(roomTypes.orgId, orgId)),
      )
      .where(eq(rooms.orgId, orgId))
      .orderBy(asc(rooms.number)),
  ]);

  return { bookings: bookingRows, guests: guestRows, rooms: roomRows };
}

export async function getBookingDetail(ctx: OrgContext, bookingId: string) {
  const orgId = ctx.org.id;

  const [booking] = await db
    .select({
      id: bookings.id,
      code: bookings.code,
      guestId: bookings.guestId,
      guestFirst: guests.firstName,
      guestLast: guests.lastName,
      roomId: bookings.roomId,
      roomNumber: rooms.number,
      checkIn: bookings.checkIn,
      checkOut: bookings.checkOut,
      adults: bookings.adults,
      children: bookings.children,
      status: bookings.status,
      source: bookings.source,
      currency: bookings.currency,
      totalAmount: bookings.totalAmount,
      paidAmount: bookings.paidAmount,
      depositAmount: bookings.depositAmount,
      specialRequests: bookings.specialRequests,
      notes: bookings.notes,
      groupId: bookings.groupId,
    })
    .from(bookings)
    .innerJoin(guests, and(eq(guests.id, bookings.guestId), eq(guests.orgId, orgId)))
    .leftJoin(rooms, and(eq(rooms.id, bookings.roomId), eq(rooms.orgId, orgId)))
    .where(and(eq(bookings.orgId, orgId), eq(bookings.id, bookingId)))
    .limit(1);

  if (!booking) return null;

  const [folio] = await db
    .select({
      id: folios.id,
      status: folios.status,
      currency: folios.currency,
      openedAt: folios.openedAt,
      closedAt: folios.closedAt,
    })
    .from(folios)
    .where(and(eq(folios.orgId, orgId), eq(folios.bookingId, bookingId)))
    .limit(1);

  const items = folio
    ? await db
        .select({
          id: folioItems.id,
          type: folioItems.type,
          description: folioItems.description,
          quantity: folioItems.quantity,
          unitPrice: folioItems.unitPrice,
          amount: folioItems.amount,
          vatRate: folioItems.vatRate,
          postedAt: folioItems.postedAt,
        })
        .from(folioItems)
        .where(and(eq(folioItems.orgId, orgId), eq(folioItems.folioId, folio.id)))
        .orderBy(asc(folioItems.postedAt))
    : [];

  return { booking, folio: folio ?? null, items };
}
