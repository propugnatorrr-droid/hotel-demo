'use server';

import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { bookings, dailyRates, rooms, roomTypes } from '@/db/schema';
import { addDays, diffDays, todayIn } from '@/lib/dates';
import { queueChannelPush } from '@/server/services/channex-sync';
import { findFreeRooms, lockInventory, priceNights, quoteStay, roomIsFree } from '@/server/services/stay';
import { audit, fail, FRONT, gate, isManager, MANAGERS, round2, run, type ActionResult } from './kit';

const moveSchema = z.object({
  bookingId: z.uuid(),
  roomId: z.uuid().nullable().optional(),
  checkIn: z.iso.date().optional(),
  checkOut: z.iso.date().optional(),
});

/** Drag-and-drop on the tape chart: change room and/or dates in one atomic step. */
export async function moveBooking(input: unknown): Promise<ActionResult<{ total: number }>> {
  return run(async () => {
    const ctx = await gate(FRONT, 'calendar');
    const p = moveSchema.parse(input);
    const today = todayIn(ctx.org.timezone);

    return db.transaction(async (tx) => {
      const [b] = await tx
        .select()
        .from(bookings)
        .where(and(eq(bookings.orgId, ctx.org.id), eq(bookings.id, p.bookingId)))
        .limit(1)
        .for('update');
      if (!b) fail('notFound');
      if (!['tentative', 'confirmed', 'checked_in'].includes(b.status)) fail('badStatus');
      const inHouse = b.status === 'checked_in';

      const checkIn = p.checkIn ?? b.checkIn;
      const checkOut = p.checkOut ?? b.checkOut;
      if (inHouse && checkIn !== b.checkIn) fail('badStatus');
      if (!inHouse && checkIn !== b.checkIn && checkIn < today) fail('pastDate');
      if (inHouse && checkOut <= today) fail('stayOver');
      if (checkOut <= checkIn) fail('nights');

      const datesChanged = checkIn !== b.checkIn || checkOut !== b.checkOut;
      let roomTypeId = b.roomTypeId;
      let roomId = b.roomId;
      let roomNumber: string | undefined;

      if (p.roomId !== undefined && p.roomId !== b.roomId) {
        if (p.roomId === null) {
          if (inHouse) fail('badStatus');
          roomId = null;
        } else {
          const [room] = await tx
            .select()
            .from(rooms)
            .where(and(eq(rooms.orgId, ctx.org.id), eq(rooms.id, p.roomId), eq(rooms.isActive, true)))
            .limit(1);
          if (!room || room.status === 'out_of_order') fail('roomInvalid');
          if (inHouse && !['clean', 'inspected'].includes(room.status)) fail('roomNotReady');
          if (room.roomTypeId !== b.roomTypeId && !isManager(ctx)) fail('forbidden');
          roomId = room.id;
          roomTypeId = room.roomTypeId;
          roomNumber = room.number;
        }
      }

      await lockInventory(tx, ctx.org.id, roomTypeId);
      if (roomTypeId !== b.roomTypeId) await lockInventory(tx, ctx.org.id, b.roomTypeId);

      let total = b.totalAmount;
      if (datesChanged || roomTypeId !== b.roomTypeId) {
        const q = await quoteStay(tx, {
          orgId: ctx.org.id,
          roomTypeId,
          checkIn,
          checkOut,
          guests: b.adults + b.children,
          excludeBookingId: b.id,
          enforceRules: false,
        });
        if (!q.ok) fail(q.reason);
        if (datesChanged) {
          const oldQuote = await priceNights(tx, { orgId: ctx.org.id, roomTypeId: b.roomTypeId, checkIn: b.checkIn, checkOut: b.checkOut });
          const negotiated = oldQuote ? Math.abs(oldQuote.total - b.totalAmount) > 0.01 : false;
          const oldNights = Math.max(1, diffDays(b.checkOut, b.checkIn));
          total = negotiated ? round2((b.totalAmount / oldNights) * q.nights) : q.total;
        }
      }

      if (roomId) {
        if (!(await roomIsFree(tx, { orgId: ctx.org.id, roomId, checkIn, checkOut, excludeBookingId: b.id }))) fail('roomTaken');
      } else if (datesChanged) {
        const free = await findFreeRooms(tx, { orgId: ctx.org.id, roomTypeId, checkIn, checkOut, excludeBookingId: b.id });
        if (free.length === 0) fail('soldOut');
      }

      await tx.update(bookings).set({ roomId, roomTypeId, checkIn, checkOut, totalAmount: total }).where(eq(bookings.id, b.id));
      await audit(tx, ctx, 'booking.moved', 'booking', b.id, {
        from: { checkIn: b.checkIn, checkOut: b.checkOut, room: b.roomId },
        to: { checkIn, checkOut, room: roomId, roomNumber },
      });
      return { total };
    }).then(async (r) => {
      await queueChannelPush(ctx.org.id, { availability: true, restrictions: false }).catch(() => undefined);
      return r;
    });
  });
}

const ratesSchema = z
  .object({
    roomTypeId: z.uuid(),
    from: z.iso.date(),
    to: z.iso.date(),
    price: z.coerce.number().min(0).max(100_000).optional(),
    adjustPct: z.coerce.number().min(-90).max(300).optional(),
    minStay: z.coerce.number().int().min(1).max(30).optional(),
    closed: z.boolean().optional(),
    weekdays: z.array(z.number().int().min(0).max(6)).optional(),
  })
  .refine((v) => v.to >= v.from && diffDays(v.to, v.from) <= 366, { message: 'range' });

/** Bulk edit of price / minimum stay / closed flag over a date range. */
export async function setRates(input: unknown): Promise<ActionResult<{ days: number }>> {
  return run(async () => {
    const ctx = await gate(MANAGERS, 'calendar');
    const p = ratesSchema.parse(input);
    if (p.price === undefined && p.adjustPct === undefined && p.minStay === undefined && p.closed === undefined) fail('invalid');

    return db.transaction(async (tx) => {
      const [type] = await tx
        .select({ basePrice: roomTypes.basePrice })
        .from(roomTypes)
        .where(and(eq(roomTypes.orgId, ctx.org.id), eq(roomTypes.id, p.roomTypeId)))
        .limit(1);
      if (!type) fail('type');

      const existing = await tx
        .select()
        .from(dailyRates)
        .where(and(eq(dailyRates.orgId, ctx.org.id), eq(dailyRates.roomTypeId, p.roomTypeId), gte(dailyRates.date, p.from), lte(dailyRates.date, p.to)));
      const byDate = new Map(existing.map((r) => [r.date, r]));

      const rows: (typeof dailyRates.$inferInsert)[] = [];
      for (let d = p.from; d <= p.to; d = addDays(d, 1)) {
        const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
        if (p.weekdays?.length && !p.weekdays.includes(dow)) continue;
        const cur = byDate.get(d);
        const curPrice = cur?.price ?? type.basePrice;
        const price = p.price !== undefined ? p.price : p.adjustPct !== undefined ? round2(curPrice * (1 + p.adjustPct / 100)) : curPrice;
        rows.push({
          orgId: ctx.org.id,
          roomTypeId: p.roomTypeId,
          date: d,
          price,
          minStay: p.minStay ?? cur?.minStay ?? 1,
          closed: p.closed ?? cur?.closed ?? false,
        });
      }
      if (rows.length === 0) fail('invalid');

      for (let i = 0; i < rows.length; i += 200) {
        await tx
          .insert(dailyRates)
          .values(rows.slice(i, i + 200))
          .onConflictDoUpdate({
            target: [dailyRates.roomTypeId, dailyRates.date],
            set: {
              price: sql`excluded.price`,
              minStay: sql`excluded.min_stay`,
              closed: sql`excluded.closed`,
              updatedAt: new Date(),
            },
          });
      }
      await audit(tx, ctx, 'rates.updated', 'room_type', p.roomTypeId, { from: p.from, to: p.to, days: rows.length });
      return { days: rows.length };
    }).then(async (r) => {
      await queueChannelPush(ctx.org.id, { availability: true, restrictions: true }).catch(() => undefined);
      return r;
    });
  });
}
