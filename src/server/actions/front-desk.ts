'use server';

import { randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/db';
import {
  auditLogs,
  bookings,
  folioItems,
  folios,
  guests,
  rooms,
  roomTypes,
} from '@/db/schema';
import { requireOrg } from '@/lib/auth/session';
import { diffDays, todayIn } from '@/lib/dates';

const id = z.string().uuid();
const date = z.iso.date();
const FRONT_ROLES = ['owner', 'manager', 'receptionist'];

function assertFrontDesk(ctx: Awaited<ReturnType<typeof requireOrg>>) {
  if (!ctx.modules.has('pms')) throw new Error('PMS is disabled');
  if (!FRONT_ROLES.includes(ctx.role) && !ctx.profile.isSuperAdmin) {
    throw new Error('Front-desk permission required');
  }
}

function refresh() {
  for (const prefix of ['', '/en']) {
    revalidatePath(`${prefix}/app`);
    revalidatePath(`${prefix}/app/bookings`);
    revalidatePath(`${prefix}/app/guests`);
    revalidatePath(`${prefix}/app/rooms`);
    revalidatePath(`${prefix}/app/housekeeping`);
    revalidatePath(`${prefix}/app/calendar`);
  }
}

function moneyCents(value: string): bigint {
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(value)) {
    throw new Error('Invalid room price');
  }
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, '0'));
}

function asMoney(cents: bigint): string {
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`;
}

function stayDates(checkIn: string, checkOut: string, today: string) {
  const nights = diffDays(checkOut, checkIn);
  if (
    checkIn < today ||
    nights < 1 ||
    nights > 60 ||
    diffDays(checkIn, today) > 730
  ) {
    throw new Error('Stay must start today or later, last 1–60 nights, and start within two years');
  }
  return nights;
}

function bookingCode(): string {
  // Database unique index remains the final arbiter of uniqueness.
  return `VL-${randomUUID().replaceAll('-', '').slice(0, 14).toUpperCase()}`;
}

function isRoomConflict(error: unknown) {
  const candidate = error as { code?: string; cause?: { code?: string } };
  return candidate.code === '23P01' || candidate.cause?.code === '23P01';
}

export async function createGuest(form: FormData) {
  const ctx = await requireOrg();
  assertFrontDesk(ctx);

  const input = z.object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    email: z.union([z.email(), z.literal('')]),
    phone: z.string().trim().max(40),
    nationality: z.string().trim().max(60),
    notes: z.string().trim().max(1000),
  }).parse({
    firstName: form.get('firstName'),
    lastName: form.get('lastName'),
    email: form.get('email') || '',
    phone: form.get('phone') || '',
    nationality: form.get('nationality') || '',
    notes: form.get('notes') || '',
  });

  await db.transaction(async (tx) => {
    const [guest] = await tx.insert(guests).values({
      orgId: ctx.org.id,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email || null,
      phone: input.phone || null,
      nationality: input.nationality || null,
      notes: input.notes || null,
      marketingConsent: form.get('marketingConsent') === 'on',
    }).returning({ id: guests.id });

    await tx.insert(auditLogs).values({
      orgId: ctx.org.id,
      userId: ctx.user.id,
      action: 'guest.created',
      entityType: 'guest',
      entityId: guest!.id,
    });
  });

  refresh();
}

export async function updateGuest(form: FormData) {
  const ctx = await requireOrg();
  assertFrontDesk(ctx);

  const guestId = id.parse(form.get('guestId'));
  const notes = z.string().trim().max(1000).parse(form.get('notes') || '');
  const isVip = form.get('isVip') === 'on';

  await db.transaction(async (tx) => {
    const [guest] = await tx
      .update(guests)
      .set({ notes: notes || null, isVip, updatedAt: new Date() })
      .where(and(eq(guests.id, guestId), eq(guests.orgId, ctx.org.id)))
      .returning({ id: guests.id });

    if (!guest) throw new Error('Guest not found in this hotel');

    await tx.insert(auditLogs).values({
      orgId: ctx.org.id,
      userId: ctx.user.id,
      action: 'guest.updated',
      entityType: 'guest',
      entityId: guestId,
      meta: { isVip },
    });
  });

  refresh();
}

/**
 * A single submit may book multiple different rooms for one guest/group.
 * The Postgres exclusion constraint prevents racing requests from both winning.
 */
export async function createBooking(form: FormData) {
  const ctx = await requireOrg();
  assertFrontDesk(ctx);

  const guestId = id.parse(form.get('guestId'));
  const selectedRooms = z.array(id).min(1).max(12).parse(form.getAll('roomId'));
  if (new Set(selectedRooms).size !== selectedRooms.length) {
    throw new Error('The same room was selected twice');
  }

  const checkIn = date.parse(form.get('checkIn'));
  const checkOut = date.parse(form.get('checkOut'));
  const nights = stayDates(checkIn, checkOut, todayIn(ctx.org.timezone));
  const adults = z.coerce.number().int().min(1).max(12).parse(form.get('adults'));
  const children = z.coerce.number().int().min(0).max(12).parse(form.get('children'));
  const requests = z.string().trim().max(1000).parse(form.get('specialRequests') || '');
  const groupId = selectedRooms.length > 1 ? randomUUID() : null;

  try {
    await db.transaction(async (tx) => {
      const [guest] = await tx
        .select({ id: guests.id })
        .from(guests)
        .where(and(eq(guests.orgId, ctx.org.id), eq(guests.id, guestId)))
        .limit(1);
      if (!guest) throw new Error('Choose a guest from this hotel');

      for (const roomId of selectedRooms) {
        const [room] = await tx
          .select({
            id: rooms.id,
            number: rooms.number,
            status: rooms.status,
            active: rooms.isActive,
            roomTypeId: rooms.roomTypeId,
            price: roomTypes.basePrice,
            maxOccupancy: roomTypes.maxOccupancy,
          })
          .from(rooms)
          .innerJoin(
            roomTypes,
            and(eq(roomTypes.id, rooms.roomTypeId), eq(roomTypes.orgId, ctx.org.id)),
          )
          .where(and(eq(rooms.id, roomId), eq(rooms.orgId, ctx.org.id)))
          .limit(1);

        if (!room || !room.active || room.status === 'out_of_order') {
          throw new Error('A selected room is unavailable');
        }
        if (adults + children > room.maxOccupancy) {
          throw new Error(`Room ${room.number} exceeds its occupancy limit`);
        }

        const total = asMoney(moneyCents(room.price) * BigInt(nights));

        const [booking] = await tx.insert(bookings).values({
          orgId: ctx.org.id,
          code: bookingCode(),
          groupId,
          guestId,
          roomId,
          roomTypeId: room.roomTypeId,
          checkIn,
          checkOut,
          adults,
          children,
          source: 'direct',
          status: 'confirmed',
          totalAmount: total,
          currency: ctx.org.currency,
          specialRequests: requests || null,
          createdBy: ctx.user.id,
        }).returning({ id: bookings.id, code: bookings.code });

        await tx.insert(auditLogs).values({
          orgId: ctx.org.id,
          userId: ctx.user.id,
          action: 'booking.created',
          entityType: 'booking',
          entityId: booking!.id,
          meta: { code: booking!.code, roomId, checkIn, checkOut, groupId },
        });
      }
    });
  } catch (error) {
    if (isRoomConflict(error)) {
      throw new Error('A room was just booked for these dates. Refresh and choose another.');
    }
    throw error;
  }

  refresh();
}

export async function cancelBooking(form: FormData) {
  const ctx = await requireOrg();
  assertFrontDesk(ctx);

  const bookingId = id.parse(form.get('bookingId'));
  const reason = z.string().trim().min(3).max(300).parse(form.get('reason'));

  await db.transaction(async (tx) => {
    const [booking] = await tx
      .update(bookings)
      .set({
        status: 'cancelled',
        cancelReason: reason,
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(bookings.orgId, ctx.org.id),
          eq(bookings.id, bookingId),
          inArray(bookings.status, ['tentative', 'confirmed']),
        ),
      )
      .returning({ id: bookings.id });

    if (!booking) throw new Error('Only an unoccupied reservation can be cancelled here');

    await tx.insert(auditLogs).values({
      orgId: ctx.org.id,
      userId: ctx.user.id,
      action: 'booking.cancelled',
      entityType: 'booking',
      entityId: bookingId,
      meta: { reason },
    });
  });

  refresh();
}

export async function checkInBooking(form: FormData) {
  const ctx = await requireOrg();
  assertFrontDesk(ctx);

  const bookingId = id.parse(form.get('bookingId'));
  const today = todayIn(ctx.org.timezone);

  await db.transaction(async (tx) => {
    const [booking] = await tx
      .update(bookings)
      .set({ status: 'checked_in', checkedInAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(bookings.orgId, ctx.org.id),
          eq(bookings.id, bookingId),
          eq(bookings.status, 'confirmed'),
          // No early arrival before the reservation begins.
          // Late check-in is allowed while the stay is still valid.
          sql`${bookings.checkIn} <= ${today}`,
          sql`${bookings.checkOut} > ${today}`,
        ),
      )
      .returning();

    if (!booking || !booking.roomId) {
      throw new Error('Booking must be confirmed, assigned a room and within its stay dates');
    }

    const [room] = await tx
      .select({ status: rooms.status, isActive: rooms.isActive })
      .from(rooms)
      .where(and(eq(rooms.id, booking.roomId), eq(rooms.orgId, ctx.org.id)))
      .limit(1);

    if (!room?.isActive || !['clean', 'inspected'].includes(room.status)) {
      throw new Error('Inspect or clean the room before check-in');
    }

    const [existing] = await tx
      .select({ id: folios.id })
      .from(folios)
      .where(and(eq(folios.orgId, ctx.org.id), eq(folios.bookingId, booking.id)))
      .limit(1);

    const folioId = existing?.id ?? (
      await tx.insert(folios).values({
        orgId: ctx.org.id,
        bookingId: booking.id,
        guestId: booking.guestId,
        currency: booking.currency,
      }).returning({ id: folios.id })
    )[0]!.id;

    const [roomCharge] = await tx
      .select({ id: folioItems.id })
      .from(folioItems)
      .where(
        and(
          eq(folioItems.orgId, ctx.org.id),
          eq(folioItems.folioId, folioId),
          eq(folioItems.type, 'room'),
          eq(folioItems.sourceRef, `booking:${booking.id}`),
        ),
      )
      .limit(1);

    if (!roomCharge) {
      await tx.insert(folioItems).values({
        orgId: ctx.org.id,
        folioId,
        type: 'room',
        description: `Accommodation ${booking.checkIn} — ${booking.checkOut}`,
        quantity: '1',
        unitPrice: booking.totalAmount,
        amount: booking.totalAmount,
        // Verify legally applicable accommodation VAT with local accountant
        // before issuing an invoice. This is NOT a fiscalized invoice.
        vatRate: '6',
        sourceRef: `booking:${booking.id}`,
        postedBy: ctx.user.id,
      });
    }

    await tx.insert(auditLogs).values({
      orgId: ctx.org.id,
      userId: ctx.user.id,
      action: 'booking.checked_in',
      entityType: 'booking',
      entityId: booking.id,
      meta: { roomId: booking.roomId },
    });
  });

  refresh();
}

export async function checkOutBooking(form: FormData) {
  const ctx = await requireOrg();
  assertFrontDesk(ctx);

  const bookingId = id.parse(form.get('bookingId'));

  await db.transaction(async (tx) => {
    const [booking] = await tx
      .update(bookings)
      .set({ status: 'checked_out', checkedOutAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(bookings.orgId, ctx.org.id),
          eq(bookings.id, bookingId),
          eq(bookings.status, 'checked_in'),
        ),
      )
      .returning({ id: bookings.id, roomId: bookings.roomId });

    if (!booking) throw new Error('Only an in-house guest can check out');

    if (booking.roomId) {
      await tx
        .update(rooms)
        .set({ status: 'dirty', updatedAt: new Date() })
        .where(
          and(
            eq(rooms.orgId, ctx.org.id),
            eq(rooms.id, booking.roomId),
            // Don't overwrite an out-of-order room.
            inArray(rooms.status, ['clean', 'inspected']),
          ),
        );
    }

    // Keep the folio OPEN. Checkout is not proof of payment or fiscalization.
    await tx.insert(auditLogs).values({
      orgId: ctx.org.id,
      userId: ctx.user.id,
      action: 'booking.checked_out',
      entityType: 'booking',
      entityId: booking.id,
      meta: { roomId: booking.roomId, folioRemainsOpen: true },
    });
  });

  refresh();
}
