import 'server-only';

import { and, asc, desc, eq, gt, ilike, inArray, lte, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { auditLogs, bookings, folioItems, folios, guests, payments, profiles, rooms, roomTypes } from '@/db/schema';
import type { OrgContext } from '@/lib/auth/session';
import { diffDays, todayIn } from '@/lib/dates';

export const BOOKING_VIEWS = ['arrivals', 'inhouse', 'departures', 'upcoming', 'all'] as const;
export type BookingView = (typeof BOOKING_VIEWS)[number];

const round2 = (n: number) => Math.round(n * 100) / 100;
export const escapeLike = (s: string) => s.replace(/[%_\\]/g, '\\$&');

const extrasSql = sql<number>`coalesce((
  select sum(fi.amount) from folio_items fi
  join folios f on f.id = fi.folio_id
  where f.org_id = ${bookings.orgId} and f.booking_id = ${bookings.id}
), 0)`.mapWith(Number);

export async function listBookings(ctx: OrgContext, view: BookingView, q: string) {
  const orgId = ctx.org.id;
  const today = todayIn(ctx.org.timezone);

  const viewWhere = {
    arrivals: and(eq(bookings.checkIn, today), inArray(bookings.status, ['tentative', 'confirmed', 'checked_in'])),
    inhouse: eq(bookings.status, 'checked_in'),
    departures: and(eq(bookings.status, 'checked_in'), lte(bookings.checkOut, today)),
    upcoming: and(gt(bookings.checkIn, today), inArray(bookings.status, ['tentative', 'confirmed'])),
    all: undefined,
  }[view];

  const term = q.trim().slice(0, 80);
  const like = `%${escapeLike(term)}%`;
  const search = term
    ? or(
        ilike(bookings.code, like),
        ilike(guests.email, like),
        ilike(guests.phone, like),
        ilike(sql`${guests.firstName} || ' ' || ${guests.lastName}`, like),
      )
    : undefined;

  const rows = await db
    .select({
      id: bookings.id,
      code: bookings.code,
      status: bookings.status,
      source: bookings.source,
      checkIn: bookings.checkIn,
      checkOut: bookings.checkOut,
      adults: bookings.adults,
      children: bookings.children,
      total: bookings.totalAmount,
      paid: bookings.paidAmount,
      eta: bookings.eta,
      extras: extrasSql,
      firstName: guests.firstName,
      lastName: guests.lastName,
      isVip: guests.isVip,
      roomNumber: rooms.number,
      typeName: roomTypes.name,
    })
    .from(bookings)
    .innerJoin(guests, and(eq(guests.id, bookings.guestId), eq(guests.orgId, orgId)))
    .innerJoin(roomTypes, and(eq(roomTypes.id, bookings.roomTypeId), eq(roomTypes.orgId, orgId)))
    .leftJoin(rooms, and(eq(rooms.id, bookings.roomId), eq(rooms.orgId, orgId)))
    .where(and(eq(bookings.orgId, orgId), viewWhere, search))
    .orderBy(
      view === 'all' ? desc(bookings.createdAt) : view === 'departures' ? asc(bookings.checkOut) : asc(bookings.checkIn),
      asc(guests.lastName),
    )
    .limit(200);

  return rows.map((r) => ({
    ...r,
    nights: diffDays(r.checkOut, r.checkIn),
    balance: round2(r.total + r.extras - r.paid),
  }));
}

export async function getBookingCounts(ctx: OrgContext) {
  const today = todayIn(ctx.org.timezone);
  const [row] = await db
    .select({
      arrivals: sql<number>`count(*) filter (where ${bookings.checkIn} = ${today} and ${bookings.status} in ('tentative','confirmed','checked_in'))`.mapWith(Number),
      inhouse: sql<number>`count(*) filter (where ${bookings.status} = 'checked_in')`.mapWith(Number),
      departures: sql<number>`count(*) filter (where ${bookings.status} = 'checked_in' and ${bookings.checkOut} <= ${today})`.mapWith(Number),
      upcoming: sql<number>`count(*) filter (where ${bookings.checkIn} > ${today} and ${bookings.status} in ('tentative','confirmed'))`.mapWith(Number),
      all: sql<number>`count(*)`.mapWith(Number),
    })
    .from(bookings)
    .where(eq(bookings.orgId, ctx.org.id));
  return row ?? { arrivals: 0, inhouse: 0, departures: 0, upcoming: 0, all: 0 };
}

export async function getBookingDetail(ctx: OrgContext, id: string | undefined) {
  if (!id || !z.uuid().safeParse(id).success) return null;
  const orgId = ctx.org.id;

  const [row] = await db
    .select({
      id: bookings.id,
      code: bookings.code,
      status: bookings.status,
      source: bookings.source,
      checkIn: bookings.checkIn,
      checkOut: bookings.checkOut,
      adults: bookings.adults,
      children: bookings.children,
      total: bookings.totalAmount,
      paid: bookings.paidAmount,
      eta: bookings.eta,
      specialRequests: bookings.specialRequests,
      notes: bookings.notes,
      cancelReason: bookings.cancelReason,
      roomId: bookings.roomId,
      roomTypeId: bookings.roomTypeId,
      extras: extrasSql,
      guestId: guests.id,
      firstName: guests.firstName,
      lastName: guests.lastName,
      email: guests.email,
      phone: guests.phone,
      nationality: guests.nationality,
      isVip: guests.isVip,
      guestNotes: guests.notes,
      roomNumber: rooms.number,
      roomStatus: rooms.status,
      typeName: roomTypes.name,
    })
    .from(bookings)
    .innerJoin(guests, and(eq(guests.id, bookings.guestId), eq(guests.orgId, orgId)))
    .innerJoin(roomTypes, and(eq(roomTypes.id, bookings.roomTypeId), eq(roomTypes.orgId, orgId)))
    .leftJoin(rooms, and(eq(rooms.id, bookings.roomId), eq(rooms.orgId, orgId)))
    .where(and(eq(bookings.orgId, orgId), eq(bookings.id, id)))
    .limit(1);

  if (!row) return null;

  const [items, pays, timeline] = await Promise.all([
    db
      .select({
        id: folioItems.id,
        type: folioItems.type,
        description: folioItems.description,
        quantity: folioItems.quantity,
        unitPrice: folioItems.unitPrice,
        amount: folioItems.amount,
        sourceRef: folioItems.sourceRef,
        postedAt: folioItems.postedAt,
      })
      .from(folioItems)
      .innerJoin(folios, eq(folios.id, folioItems.folioId))
      .where(and(eq(folios.orgId, orgId), eq(folios.bookingId, id)))
      .orderBy(asc(folioItems.postedAt)),
    db
      .select({
        id: payments.id,
        amount: payments.amount,
        method: payments.method,
        isRefund: payments.isRefund,
        isDeposit: payments.isDeposit,
        reference: payments.reference,
        receivedAt: payments.receivedAt,
      })
      .from(payments)
      .where(and(eq(payments.orgId, orgId), eq(payments.bookingId, id)))
      .orderBy(desc(payments.receivedAt)),
    db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        createdAt: auditLogs.createdAt,
        who: profiles.fullName,
      })
      .from(auditLogs)
      .leftJoin(profiles, eq(profiles.id, auditLogs.userId))
      .where(and(eq(auditLogs.orgId, orgId), eq(auditLogs.entityType, 'booking'), eq(auditLogs.entityId, id)))
      .orderBy(desc(auditLogs.createdAt))
      .limit(30),
  ]);

  const voided = new Set(
    items.filter((i) => i.sourceRef?.startsWith('void:')).map((i) => i.sourceRef!.slice(5)),
  );

  return {
    ...row,
    nights: diffDays(row.checkOut, row.checkIn),
    balance: round2(row.total + row.extras - row.paid),
    items: items.map((i) => ({
      ...i,
      postedAt: i.postedAt.toISOString(),
      voided: voided.has(i.id),
      reversal: Boolean(i.sourceRef?.startsWith('void:')),
    })),
    payments: pays.map((p) => ({ ...p, receivedAt: p.receivedAt.toISOString() })),
    timeline: timeline.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
  };
}

export async function getBookingFormData(ctx: OrgContext) {
  const orgId = ctx.org.id;
  const [types, roomRows] = await Promise.all([
    db
      .select({
        id: roomTypes.id,
        code: roomTypes.code,
        name: roomTypes.name,
        maxOccupancy: roomTypes.maxOccupancy,
        basePrice: roomTypes.basePrice,
      })
      .from(roomTypes)
      .where(and(eq(roomTypes.orgId, orgId), eq(roomTypes.isActive, true)))
      .orderBy(asc(roomTypes.sortOrder), asc(roomTypes.code)),
    db
      .select({ id: rooms.id, number: rooms.number, roomTypeId: rooms.roomTypeId, status: rooms.status })
      .from(rooms)
      .where(and(eq(rooms.orgId, orgId), eq(rooms.isActive, true)))
      .orderBy(asc(rooms.number)),
  ]);
  return { roomTypes: types, rooms: roomRows };
}

export type BookingRow = Awaited<ReturnType<typeof listBookings>>[number];
export type BookingCounts = Awaited<ReturnType<typeof getBookingCounts>>;
export type BookingDetail = NonNullable<Awaited<ReturnType<typeof getBookingDetail>>>;
export type BookingFormData = Awaited<ReturnType<typeof getBookingFormData>>;
