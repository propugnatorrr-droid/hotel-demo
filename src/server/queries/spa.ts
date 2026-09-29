import 'server-only';
import { and, asc, eq, gte, lt } from 'drizzle-orm';
import { db } from '@/db';
import { bookings, guests, rooms, spaAppointments, spaServices, spaTherapists } from '@/db/schema';
import type { OrgContext } from '@/lib/auth/session';
import { addDays, timeIn, zonedToUtc } from '@/lib/dates';
import { localized } from '@/lib/utils';

export async function getSpa(ctx: OrgContext, date: string, locale: string) {
  const orgId = ctx.org.id;
  const tz = ctx.org.timezone;
  const from = zonedToUtc(date, '00:00', tz);
  const to = zonedToUtc(addDays(date, 1), '00:00', tz);

  const [services, therapists, appts, inHouse] = await Promise.all([
    db.select().from(spaServices).where(eq(spaServices.orgId, orgId)).orderBy(asc(spaServices.sortOrder), asc(spaServices.price)),
    db.select().from(spaTherapists).where(and(eq(spaTherapists.orgId, orgId), eq(spaTherapists.isActive, true))).orderBy(asc(spaTherapists.name)),
    db
      .select()
      .from(spaAppointments)
      .where(and(eq(spaAppointments.orgId, orgId), gte(spaAppointments.startsAt, from), lt(spaAppointments.startsAt, to)))
      .orderBy(asc(spaAppointments.startsAt)),
    db
      .select({ id: bookings.id, room: rooms.number, first: guests.firstName, last: guests.lastName })
      .from(bookings)
      .innerJoin(rooms, eq(rooms.id, bookings.roomId))
      .innerJoin(guests, eq(guests.id, bookings.guestId))
      .where(and(eq(bookings.orgId, orgId), eq(bookings.status, 'checked_in')))
      .orderBy(asc(rooms.number))
      .limit(120),
  ]);

  const svcName = new Map(services.map((s) => [s.id, localized(s.name, locale)]));
  return {
    date,
    services: services.map((s) => ({ id: s.id, nameSq: s.name.sq, nameEn: s.name.en, name: localized(s.name, locale), durationMin: s.durationMin, price: s.price, isActive: s.isActive })),
    therapists: therapists.map((t) => ({ id: t.id, name: t.name, specialties: t.specialties })),
    appointments: appts.map((a) => ({
      id: a.id, serviceId: a.serviceId, serviceName: svcName.get(a.serviceId) ?? '', therapistId: a.therapistId, guestName: a.guestName, bookingId: a.bookingId,
      start: timeIn(tz, a.startsAt), end: timeIn(tz, a.endsAt), status: a.status, price: a.price, charged: a.chargedToFolio, notes: a.notes,
    })),
    inHouse: inHouse.map((b) => ({ id: b.id, label: `${b.room} · ${b.first} ${b.last}` })),
  };
}

export type SpaData = Awaited<ReturnType<typeof getSpa>>;
