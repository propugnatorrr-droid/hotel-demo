'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { z } from 'zod';
import { OTA_SOURCES } from '@/config/channels';
import { db } from '@/db';
import { auditLogs, bookings, dailyRates, rooms, roomTypes } from '@/db/schema';
import { requireOrg } from '@/lib/auth/session';
import { addDays, diffDays, todayIn } from '@/lib/dates';
import { lockInventory, quoteStay, roomIsFree, type QuoteWarning } from '@/server/services/stay';
import type { ActionResult } from './bookings';
import { queueChannelPush } from '@/server/services/channel-sync';

type Ctx = Awaited<ReturnType<typeof requireOrg>>;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Booking = typeof bookings.$inferSelect;

const FRONT = ['owner', 'manager', 'receptionist'];
const MANAGERS = ['owner', 'manager'];

class ActionError extends Error {}
function fail(code: string): never {
  throw new ActionError(code);
}

const isManager = (ctx: Ctx) => MANAGERS.includes(ctx.role) || ctx.profile.isSuperAdmin;

async function staff(module: 'pms' | 'calendar'): Promise<Ctx> {
  const ctx = await requireOrg();
  if (!ctx.modules.has(module)) fail('module');
  if (!FRONT.includes(ctx.role) && !ctx.profile.isSuperAdmin) fail('forbidden');
  return ctx;
}

function pgCode(e: unknown) {
  const x = e as { code?: string; cause?: { code?: string } };
  return x?.code ?? x?.cause?.code;
}

async function run<T>(fn: () => Promise<T>, mutate = true): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    if (mutate) {
      revalidatePath('/[locale]/app', 'layout');
      await queueChannelPush();
    }
    return { ok: true, data };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ActionError) return { ok: false, error: error.message };
    if (error instanceof z.ZodError) return { ok: false, error: 'invalid' };
    const code = pgCode(error);
    if (code === '23P01') return { ok: false, error: 'roomTaken' };
    if (code === '23514') return { ok: false, error: 'invalid' };
    console.error('[calendar]', error);
    return { ok: false, error: 'unknown' };
  }
}

async function lockedBooking(tx: Tx, orgId: string, id: string): Promise<Booking> {
  const [b] = await tx
    .select()
    .from(bookings)
    .where(and(eq(bookings.orgId, orgId), eq(bookings.id, id)))
    .limit(1)
    .for('update');
  if (!b) fail('notFound');
  return b;
}

/* ───────────────────────── Stay change (drag / resize) ───────────────────────── */

const changeSchema = z.object({
  bookingId: z.uuid(),
  roomId: z.uuid().nullable(),
  checkIn: z.iso.date(),
  checkOut: z.iso.date(),
  pricing: z.enum(['auto', 'keep', 'requote']).default('auto'),
});
type ChangeInput = z.infer<typeof changeSchema>;

export type StayChangePreview = {
  checkIn: string;
  checkOut: string;
  nights: number;
  previousNights: number;
  roomTypeId: string;
  roomNumber: string | null;
  upgrade: boolean;
  previousTotal: number;
  quotedTotal: number;
  total: number;
  pricing: 'keep' | 'requote';
  canKeep: boolean;
  warnings: QuoteWarning[];
  ota: boolean;
};

async function planChange(tx: Tx, ctx: Ctx, b: Booking, p: ChangeInput, lock: boolean): Promise<StayChangePreview> {
  const today = todayIn(ctx.org.timezone);
  if (!['tentative', 'confirmed', 'checked_in'].includes(b.status)) fail('badStatus');

  const nights = diffDays(p.checkOut, p.checkIn);
  const previousNights = diffDays(b.checkOut, b.checkIn);
  if (nights < 1 || nights > 60) fail('nights');

  if (b.status === 'checked_in') {
    // In-house: only the departure date can change here. Room moves go through assignRoom.
    if (p.checkIn !== b.checkIn) fail('inHouseDates');
    if (p.roomId !== b.roomId) fail('inHouseRoom');
    if (p.checkOut <= today) fail('stayOver');
  } else if (p.checkIn !== b.checkIn && p.checkIn < today) {
    fail('pastDate');
  }

  let roomTypeId = b.roomTypeId;
  let roomNumber: string | null = null;
  if (p.roomId) {
    const [room] = await tx
      .select({ typeId: rooms.roomTypeId, status: rooms.status, number: rooms.number })
      .from(rooms)
      .where(and(eq(rooms.orgId, ctx.org.id), eq(rooms.id, p.roomId), eq(rooms.isActive, true)))
      .limit(1);
    if (!room || room.status === 'out_of_order') fail('roomInvalid');
    roomTypeId = room.typeId;
    roomNumber = room.number;
  }

  const upgrade = roomTypeId !== b.roomTypeId;
  if (upgrade && !isManager(ctx)) fail('forbidden');
  if (lock) await lockInventory(tx, ctx.org.id, roomTypeId);

  // Staff override: closed dates / min stay become warnings, sold out still blocks.
  const quote = await quoteStay(tx, {
    orgId: ctx.org.id,
    roomTypeId,
    checkIn: p.checkIn,
    checkOut: p.checkOut,
    guests: b.adults + b.children,
    excludeBookingId: b.id,
    enforceRules: false,
  });
  if (!quote.ok) fail(quote.reason);

  if (
    p.roomId &&
    !(await roomIsFree(tx, { orgId: ctx.org.id, roomId: p.roomId, checkIn: p.checkIn, checkOut: p.checkOut, excludeBookingId: b.id }))
  ) {
    fail('roomTaken');
  }

  const nightsChanged = nights !== previousNights;
  const canKeep = !nightsChanged || isManager(ctx);
  const pricing: 'keep' | 'requote' = p.pricing === 'auto' ? (nightsChanged ? 'requote' : 'keep') : p.pricing;
  if (pricing === 'keep' && !canKeep) fail('forbidden');

  return {
    checkIn: p.checkIn,
    checkOut: p.checkOut,
    nights,
    previousNights,
    roomTypeId,
    roomNumber,
    upgrade,
    previousTotal: b.totalAmount,
    quotedTotal: quote.total,
    total: pricing === 'requote' ? quote.total : b.totalAmount,
    pricing,
    canKeep,
    warnings: quote.warnings,
    ota: (OTA_SOURCES as readonly string[]).includes(b.source),
  };
}

export async function previewStayChange(input: unknown): Promise<ActionResult<StayChangePreview>> {
  return run(async () => {
    const ctx = await staff('pms');
    const p = changeSchema.parse(input);
    return db.transaction(async (tx) => {
      const b = await lockedBooking(tx, ctx.org.id, p.bookingId);
      return planChange(tx, ctx, b, p, false);
    });
  }, false);
}

export async function changeStay(input: unknown): Promise<ActionResult<{ total: number }>> {
  return run(async () => {
    const ctx = await staff('pms');
    const p = changeSchema.parse(input);
    return db.transaction(async (tx) => {
      const b = await lockedBooking(tx, ctx.org.id, p.bookingId);
      const plan = await planChange(tx, ctx, b, p, true);

      await tx
        .update(bookings)
        .set({
          checkIn: plan.checkIn,
          checkOut: plan.checkOut,
          roomId: p.roomId,
          roomTypeId: plan.roomTypeId,
          totalAmount: plan.total,
        })
        .where(and(eq(bookings.orgId, ctx.org.id), eq(bookings.id, b.id)));

      await tx.insert(auditLogs).values({
        orgId: ctx.org.id,
        userId: ctx.user.id,
        action: 'booking.stay_changed',
        entityType: 'booking',
        entityId: b.id,
        meta: {
          from: { checkIn: b.checkIn, checkOut: b.checkOut, roomId: b.roomId, total: b.totalAmount },
          to: { checkIn: plan.checkIn, checkOut: plan.checkOut, roomId: p.roomId, total: plan.total },
          pricing: plan.pricing,
          warnings: plan.warnings,
        },
      });
      return { total: plan.total };
    });
  });
}

/* ───────────────────────── Rates & availability ───────────────────────── */

const ratesSchema = z.object({
  roomTypeId: z.uuid(),
  from: z.iso.date(),
  to: z.iso.date(),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  price: z.coerce.number().min(0).max(100_000).optional(),
  minStay: z.coerce.number().int().min(1).max(30).optional(),
  closed: z.boolean().optional(),
});

export async function updateRates(input: unknown): Promise<ActionResult<{ days: number }>> {
  return run(async () => {
    const ctx = await staff('calendar');
    if (!isManager(ctx)) fail('forbidden');
    const p = ratesSchema.parse(input);
    if (p.price === undefined && p.minStay === undefined && p.closed === undefined) fail('nothing');

    const today = todayIn(ctx.org.timezone);
    if (p.from < today) fail('pastDate');
    const span = diffDays(p.to, p.from);
    if (span < 0 || span > 366) fail('range');

    const weekdays = new Set(p.weekdays);
    const dates: string[] = [];
    for (let i = 0; i <= span; i++) {
      const d = addDays(p.from, i);
      if (weekdays.has(new Date(`${d}T00:00:00Z`).getUTCDay())) dates.push(d);
    }
    if (dates.length === 0) fail('nothing');

    return db.transaction(async (tx) => {
      const [type] = await tx
        .select({ basePrice: roomTypes.basePrice })
        .from(roomTypes)
        .where(and(eq(roomTypes.orgId, ctx.org.id), eq(roomTypes.id, p.roomTypeId)))
        .limit(1);
      if (!type) fail('type');

      await tx
        .insert(dailyRates)
        .values(
          dates.map((date) => ({
            orgId: ctx.org.id,
            roomTypeId: p.roomTypeId,
            date,
            price: p.price ?? type.basePrice,
            minStay: p.minStay ?? 1,
            closed: p.closed ?? false,
          })),
        )
        .onConflictDoUpdate({
          target: [dailyRates.roomTypeId, dailyRates.date],
          set: {
            ...(p.price !== undefined ? { price: p.price } : {}),
            ...(p.minStay !== undefined ? { minStay: p.minStay } : {}),
            ...(p.closed !== undefined ? { closed: p.closed } : {}),
            updatedAt: new Date(),
          },
        });

      await tx.insert(auditLogs).values({
        orgId: ctx.org.id,
        userId: ctx.user.id,
        action: 'rates.updated',
        entityType: 'room_type',
        entityId: p.roomTypeId,
        meta: { from: p.from, to: p.to, weekdays: p.weekdays, price: p.price, minStay: p.minStay, closed: p.closed, days: dates.length },
      });
      await queueChannelPush(ctx.org.id, { availability: true, restrictions: true });
      return { days: dates.length };
    });
  });
}
