'use server';

import { and, eq, gt, inArray, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { bookings, folioItems, folios, guests, spaAppointments, spaServices, spaTherapists } from '@/db/schema';
import { SPA_CLOSE, SPA_OPEN } from '@/config/spa';
import { zonedToUtc } from '@/lib/dates';
import { audit, fail, gate, MANAGERS, run, type ActionResult } from './kit';

const SPA_ROLES = ['owner', 'manager', 'receptionist', 'spa'] as const;

const bookSchema = z.object({
  serviceId: z.uuid(),
  therapistId: z.uuid(),
  date: z.iso.date(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  bookingId: z.uuid().optional(),
  guestName: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(300).optional(),
});

export async function bookAppointment(input: unknown): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const ctx = await gate(SPA_ROLES, 'spa');
    const p = bookSchema.parse(input);
    if (!p.bookingId && !p.guestName) fail('guestRequired');

    return db.transaction(async (tx) => {
      const [svc] = await tx.select().from(spaServices).where(and(eq(spaServices.orgId, ctx.org.id), eq(spaServices.id, p.serviceId), eq(spaServices.isActive, true))).limit(1);
      const [th] = await tx.select().from(spaTherapists).where(and(eq(spaTherapists.orgId, ctx.org.id), eq(spaTherapists.id, p.therapistId), eq(spaTherapists.isActive, true))).limit(1);
      if (!svc || !th) fail('notFound');

      const startsAt = zonedToUtc(p.date, p.time, ctx.org.timezone);
      const endsAt = new Date(startsAt.getTime() + svc.durationMin * 60_000);
      const closeAt = zonedToUtc(p.date, SPA_CLOSE, ctx.org.timezone);
      if (startsAt < zonedToUtc(p.date, SPA_OPEN, ctx.org.timezone) || endsAt > closeAt) fail('outsideHours');

      // Serialize per therapist to avoid double-booking races.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${ctx.org.id}:${th.id}`}, 0))`);
      const [clash] = await tx
        .select({ id: spaAppointments.id })
        .from(spaAppointments)
        .where(and(eq(spaAppointments.orgId, ctx.org.id), eq(spaAppointments.therapistId, th.id), inArray(spaAppointments.status, ['booked', 'confirmed']), lt(spaAppointments.startsAt, endsAt), gt(spaAppointments.endsAt, startsAt)))
        .limit(1);
      if (clash) fail('therapistBusy');

      let guestId: string | null = null;
      let guestName = p.guestName ?? null;
      if (p.bookingId) {
        const [b] = await tx
          .select({ id: bookings.id, guestId: bookings.guestId, first: guests.firstName, last: guests.lastName })
          .from(bookings)
          .innerJoin(guests, eq(guests.id, bookings.guestId))
          .where(and(eq(bookings.orgId, ctx.org.id), eq(bookings.id, p.bookingId)))
          .limit(1);
        if (!b) fail('notFound');
        guestId = b.guestId;
        guestName = `${b.first} ${b.last}`;
      }

      const [a] = await tx
        .insert(spaAppointments)
        .values({ orgId: ctx.org.id, serviceId: svc.id, therapistId: th.id, guestId, bookingId: p.bookingId ?? null, guestName, startsAt, endsAt, price: svc.price, notes: p.notes || null })
        .returning({ id: spaAppointments.id });
      await audit(tx, ctx, 'spa.booked', 'spa_appointment', a!.id, { service: svc.name.sq });
      return { id: a!.id };
    });
  });
}

export async function setAppointmentStatus(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const ctx = await gate(SPA_ROLES, 'spa');
    const p = z.object({ id: z.uuid(), status: z.enum(['confirmed', 'completed', 'cancelled', 'no_show']) }).parse(input);
    const [a] = await db.update(spaAppointments).set({ status: p.status }).where(and(eq(spaAppointments.orgId, ctx.org.id), eq(spaAppointments.id, p.id))).returning({ id: spaAppointments.id });
    if (!a) fail('notFound');
    await audit(db, ctx, `spa.${p.status}`, 'spa_appointment', a.id);
    return null;
  });
}

export async function chargeAppointmentToRoom(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const ctx = await gate(SPA_ROLES, 'spa');
    const { id } = z.object({ id: z.uuid() }).parse(input);
    await db.transaction(async (tx) => {
      const [a] = await tx.select().from(spaAppointments).where(and(eq(spaAppointments.orgId, ctx.org.id), eq(spaAppointments.id, id))).limit(1).for('update');
      if (!a) fail('notFound');
      if (a.chargedToFolio) fail('alreadyCharged');
      if (!a.bookingId) fail('noBooking');
      if (a.status === 'cancelled' || a.status === 'no_show') fail('badStatus');
      const [b] = await tx.select().from(bookings).where(and(eq(bookings.orgId, ctx.org.id), eq(bookings.id, a.bookingId), eq(bookings.status, 'checked_in'))).limit(1);
      if (!b) fail('notInHouse');
      const [svc] = await tx.select().from(spaServices).where(eq(spaServices.id, a.serviceId)).limit(1);
      let [f] = await tx.select({ id: folios.id }).from(folios).where(and(eq(folios.orgId, ctx.org.id), eq(folios.bookingId, b.id), eq(folios.status, 'open'))).limit(1);
      if (!f) [f] = await tx.insert(folios).values({ orgId: ctx.org.id, bookingId: b.id, guestId: b.guestId, currency: b.currency }).returning({ id: folios.id });
      await tx.insert(folioItems).values({ orgId: ctx.org.id, folioId: f!.id, type: 'spa', description: svc?.name.sq ?? 'Spa', quantity: 1, unitPrice: a.price, amount: a.price, vatRate: svc?.vatRate ?? 20, sourceRef: `spa:${a.id}`, postedBy: ctx.user.id });
      await tx.update(spaAppointments).set({ chargedToFolio: true, status: a.status === 'booked' ? 'completed' : a.status }).where(eq(spaAppointments.id, a.id));
      await audit(tx, ctx, 'spa.charged_to_room', 'spa_appointment', a.id, { amount: a.price });
    });
    return null;
  });
}

export async function saveSpaService(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const ctx = await gate(MANAGERS, 'spa');
    const p = z
      .object({
        id: z.uuid().optional(),
        nameSq: z.string().trim().min(2).max(100),
        nameEn: z.string().trim().min(2).max(100),
        durationMin: z.coerce.number().int().min(10).max(480),
        price: z.coerce.number().min(0).max(100_000),
        isActive: z.boolean().default(true),
      })
      .parse(input);
    const values = { name: { sq: p.nameSq, en: p.nameEn }, durationMin: p.durationMin, price: p.price, isActive: p.isActive };
    if (p.id) await db.update(spaServices).set(values).where(and(eq(spaServices.orgId, ctx.org.id), eq(spaServices.id, p.id)));
    else await db.insert(spaServices).values({ orgId: ctx.org.id, ...values });
    await audit(db, ctx, 'spa.service_saved', 'spa_service', p.id ?? null, { price: p.price });
    return null;
  });
}
