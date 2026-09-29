'use server';

import { and, eq, inArray, or, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/db';
import { auditLogs, bookings, folioItems, folios, guests, housekeepingTasks, payments, rooms } from '@/db/schema';
import { requireOrg } from '@/lib/auth/session';
import { todayIn } from '@/lib/dates';
import { findFreeRooms, lockInventory, quoteStay, roomIsFree, type Quote } from '@/server/services/stay';
import { queueChannelPush } from '@/server/services/channel-sync';

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

type Ctx = Awaited<ReturnType<typeof requireOrg>>;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const FRONT = ['owner', 'manager', 'receptionist'];
const MANAGERS = ['owner', 'manager'];
const round2 = (n: number) => Math.round(n * 100) / 100;

class ActionError extends Error {}
function fail(code: string): never {
  throw new ActionError(code);
}

async function staff(): Promise<Ctx> {
  const ctx = await requireOrg();
  if (!ctx.modules.has('pms')) fail('module');
  if (!FRONT.includes(ctx.role) && !ctx.profile.isSuperAdmin) fail('forbidden');
  return ctx;
}
const isManager = (ctx: Ctx) => MANAGERS.includes(ctx.role) || ctx.profile.isSuperAdmin;

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
    unstable_rethrow(error); // keep login redirects working
    if (error instanceof ActionError) return { ok: false, error: error.message };
    if (error instanceof z.ZodError) return { ok: false, error: 'invalid' };
    const code = pgCode(error);
    if (code === '23P01') return { ok: false, error: 'roomTaken' };
    if (code === '23505') return { ok: false, error: 'duplicate' };
    if (code === '23514') return { ok: false, error: 'invalid' };
    console.error('[bookings]', error);
    return { ok: false, error: 'unknown' };
  }
}

async function audit(tx: Tx, ctx: Ctx, action: string, entityId: string, meta: Record<string, unknown> = {}, entityType = 'booking') {
  await tx.insert(auditLogs).values({ orgId: ctx.org.id, userId: ctx.user.id, action, entityType, entityId, meta });
}

async function lockedBooking(tx: Tx, orgId: string, id: string) {
  const [b] = await tx
    .select()
    .from(bookings)
    .where(and(eq(bookings.orgId, orgId), eq(bookings.id, id)))
    .limit(1)
    .for('update');
  if (!b) fail('notFound');
  return b;
}

async function extrasFor(tx: Tx, orgId: string, bookingId: string) {
  const [row] = await tx
    .select({ sum: sql<number>`coalesce(sum(${folioItems.amount}), 0)`.mapWith(Number) })
    .from(folioItems)
    .innerJoin(folios, eq(folios.id, folioItems.folioId))
    .where(and(eq(folios.orgId, orgId), eq(folios.bookingId, bookingId)));
  return row?.sum ?? 0;
}

async function ensureFolio(tx: Tx, b: typeof bookings.$inferSelect) {
  const [open] = await tx
    .select({ id: folios.id })
    .from(folios)
    .where(and(eq(folios.orgId, b.orgId), eq(folios.bookingId, b.id), eq(folios.status, 'open')))
    .limit(1);
  if (open) return open.id;
  const [created] = await tx
    .insert(folios)
    .values({ orgId: b.orgId, bookingId: b.id, guestId: b.guestId, currency: b.currency })
    .returning({ id: folios.id });
  return created!.id;
}

function bookingCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `BK-${Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')}`;
}

const normalizePhone = (p?: string) => {
  const v = (p ?? '').replace(/[^\d+]/g, '');
  return v.length >= 6 ? v : null;
};

/* ───────────────────────── Quote ───────────────────────── */

const quoteSchema = z.object({
  roomTypeId: z.uuid(),
  checkIn: z.iso.date(),
  checkOut: z.iso.date(),
  guests: z.coerce.number().int().min(1).max(24).optional(),
});

export async function getStayQuote(input: unknown): Promise<ActionResult<Quote>> {
  return run(async () => {
    const ctx = await staff();
    const p = quoteSchema.parse(input);
    return quoteStay(db, { orgId: ctx.org.id, ...p });
  }, false);
}

/* ───────────────────────── Create ───────────────────────── */

const SOURCES = ['direct', 'website', 'booking_com', 'airbnb', 'expedia', 'agoda', 'whatsapp', 'instagram', 'messenger', 'phone', 'walk_in'] as const;

const createSchema = z.object({
  roomTypeId: z.uuid(),
  checkIn: z.iso.date(),
  checkOut: z.iso.date(),
  adults: z.coerce.number().int().min(1).max(12),
  children: z.coerce.number().int().min(0).max(12),
  source: z.enum(SOURCES),
  status: z.enum(['tentative', 'confirmed']),
  roomId: z.uuid().optional(),
  autoAssign: z.boolean().default(true),
  priceOverride: z.coerce.number().min(0).max(1_000_000).optional(),
  eta: z.string().trim().max(20).optional(),
  specialRequests: z.string().trim().max(1000).optional(),
  notes: z.string().trim().max(1000).optional(),
  guestId: z.uuid().optional(),
  guest: z
    .object({
      firstName: z.string().trim().min(1).max(80),
      lastName: z.string().trim().min(1).max(80),
      email: z.string().trim().max(160).optional(),
      phone: z.string().trim().max(40).optional(),
      nationality: z.string().trim().max(56).optional(),
    })
    .optional(),
});

async function resolveGuest(tx: Tx, orgId: string, p: z.infer<typeof createSchema>) {
  if (p.guestId) {
    const [g] = await tx.select({ id: guests.id }).from(guests).where(and(eq(guests.orgId, orgId), eq(guests.id, p.guestId))).limit(1);
    if (!g) fail('guestNotFound');
    return g.id;
  }
  const guest = p.guest ?? fail('guestRequired');
  const email = guest.email ? guest.email.toLowerCase() : null;
  if (email && !z.email().safeParse(email).success) fail('email');
  const phone = normalizePhone(guest.phone);

  if (email || phone) {
    const [existing] = await tx
      .select({ id: guests.id })
      .from(guests)
      .where(
        and(
          eq(guests.orgId, orgId),
          or(email ? sql`lower(${guests.email}) = ${email}` : undefined, phone ? eq(guests.phone, phone) : undefined),
        ),
      )
      .limit(1);
    if (existing) return existing.id;
  }

  const [created] = await tx
    .insert(guests)
    .values({
      orgId,
      firstName: guest.firstName,
      lastName: guest.lastName,
      email,
      phone,
      nationality: guest.nationality || null,
    })
    .returning({ id: guests.id });
  return created!.id;
}

export async function createBooking(input: unknown): Promise<ActionResult<{ id: string; code: string }>> {
  return run(async () => {
    const ctx = await staff();
    const p = createSchema.parse(input);
    const today = todayIn(ctx.org.timezone);
    if (p.checkIn < today) fail('pastDate');
    if (p.priceOverride !== undefined && !isManager(ctx)) fail('forbidden');

    return db.transaction(async (tx) => {
      await lockInventory(tx, ctx.org.id, p.roomTypeId);
      const quote = await quoteStay(tx, {
        orgId: ctx.org.id,
        roomTypeId: p.roomTypeId,
        checkIn: p.checkIn,
        checkOut: p.checkOut,
        guests: p.adults + p.children,
      });
      if (!quote.ok) fail(quote.reason);

      const guestId = await resolveGuest(tx, ctx.org.id, p);

      let roomId: string | null = null;
      if (p.roomId) {
        const [room] = await tx
          .select({ id: rooms.id, typeId: rooms.roomTypeId, status: rooms.status })
          .from(rooms)
          .where(and(eq(rooms.orgId, ctx.org.id), eq(rooms.id, p.roomId), eq(rooms.isActive, true)))
          .limit(1);
        if (!room || room.typeId !== p.roomTypeId || room.status === 'out_of_order') fail('roomInvalid');
        if (!(await roomIsFree(tx, { orgId: ctx.org.id, roomId: room.id, checkIn: p.checkIn, checkOut: p.checkOut }))) fail('roomTaken');
        roomId = room.id;
      } else if (p.autoAssign) {
        const [free] = await findFreeRooms(tx, { orgId: ctx.org.id, roomTypeId: p.roomTypeId, checkIn: p.checkIn, checkOut: p.checkOut });
        roomId = free?.id ?? null;
      }

      const total = round2(p.priceOverride ?? quote.total);
      const [created] = await tx
        .insert(bookings)
        .values({
          orgId: ctx.org.id,
          code: bookingCode(),
          guestId,
          roomTypeId: p.roomTypeId,
          roomId,
          checkIn: p.checkIn,
          checkOut: p.checkOut,
          adults: p.adults,
          children: p.children,
          status: p.status,
          source: p.source,
          totalAmount: total,
          currency: ctx.org.currency,
          eta: p.eta || null,
          specialRequests: p.specialRequests || null,
          notes: p.notes || null,
          createdBy: ctx.user.id,
        })
        .returning({ id: bookings.id, code: bookings.code });

      await audit(tx, ctx, 'booking.created', created!.id, { total, quoted: quote.total, source: p.source });
      return created!;
    });
  });
}

/* ───────────────────────── Lifecycle ───────────────────────── */

const idSchema = z.uuid();

export async function confirmBooking(bookingId: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await staff();
    const id = idSchema.parse(bookingId);
    await db.transaction(async (tx) => {
      const b = await lockedBooking(tx, ctx.org.id, id);
      if (b.status !== 'tentative') fail('badStatus');
      await tx.update(bookings).set({ status: 'confirmed' }).where(eq(bookings.id, b.id));
      await audit(tx, ctx, 'booking.confirmed', b.id);
    });
    return null;
  });
}

export async function assignRoom(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const ctx = await staff();
    const p = z.object({ bookingId: z.uuid(), roomId: z.uuid().nullable() }).parse(input);
    const today = todayIn(ctx.org.timezone);

    await db.transaction(async (tx) => {
      const b = await lockedBooking(tx, ctx.org.id, p.bookingId);
      if (!['tentative', 'confirmed', 'checked_in'].includes(b.status)) fail('badStatus');

      if (!p.roomId) {
        if (b.status === 'checked_in') fail('badStatus');
        await tx.update(bookings).set({ roomId: null }).where(eq(bookings.id, b.id));
        await audit(tx, ctx, 'booking.room_unassigned', b.id);
        return;
      }

      const [room] = await tx
        .select()
        .from(rooms)
        .where(and(eq(rooms.orgId, ctx.org.id), eq(rooms.id, p.roomId), eq(rooms.isActive, true)))
        .limit(1);
      if (!room || room.status === 'out_of_order') fail('roomInvalid');
      if (b.status === 'checked_in' && !['clean', 'inspected'].includes(room.status)) fail('roomNotReady');

      const upgrade = room.roomTypeId !== b.roomTypeId;
      if (upgrade) {
        if (!isManager(ctx)) fail('forbidden');
        await lockInventory(tx, ctx.org.id, room.roomTypeId);
        const q = await quoteStay(tx, {
          orgId: ctx.org.id,
          roomTypeId: room.roomTypeId,
          checkIn: b.checkIn,
          checkOut: b.checkOut,
          excludeBookingId: b.id,
        });
        if (!q.ok && q.reason === 'soldOut') fail('soldOut');
      }

      if (!(await roomIsFree(tx, { orgId: ctx.org.id, roomId: room.id, checkIn: b.checkIn, checkOut: b.checkOut, excludeBookingId: b.id }))) {
        fail('roomTaken');
      }

      await tx
        .update(bookings)
        .set({ roomId: room.id, roomTypeId: room.roomTypeId })
        .where(eq(bookings.id, b.id));

      // In-house room move: the vacated room needs cleaning.
      if (b.status === 'checked_in' && b.roomId && b.roomId !== room.id) {
        await tx.update(rooms).set({ status: 'dirty' }).where(and(eq(rooms.orgId, ctx.org.id), eq(rooms.id, b.roomId)));
        await tx.insert(housekeepingTasks).values({
          orgId: ctx.org.id,
          roomId: b.roomId,
          type: 'checkout_clean',
          priority: 'high',
          dueDate: today,
        });
      }

      await audit(tx, ctx, upgrade ? 'booking.upgraded' : 'booking.room_assigned', b.id, { room: room.number });
    });
    return null;
  });
}

export async function checkInBooking(bookingId: string): Promise<ActionResult<{ room: string }>> {
  return run(async () => {
    const ctx = await staff();
    const id = idSchema.parse(bookingId);
    const today = todayIn(ctx.org.timezone);

    return db.transaction(async (tx) => {
      const b = await lockedBooking(tx, ctx.org.id, id);
      if (b.status === 'tentative') fail('notConfirmed');
      if (b.status !== 'confirmed') fail('badStatus');
      if (b.checkIn > today) fail('tooEarly');
      if (b.checkOut <= today) fail('stayOver');

      let room: { id: string; number: string; status: string } | undefined;
      if (b.roomId) {
        [room] = await tx
          .select({ id: rooms.id, number: rooms.number, status: rooms.status })
          .from(rooms)
          .where(and(eq(rooms.orgId, ctx.org.id), eq(rooms.id, b.roomId)))
          .limit(1);
      } else {
        await lockInventory(tx, ctx.org.id, b.roomTypeId);
        const free = await findFreeRooms(tx, {
          orgId: ctx.org.id,
          roomTypeId: b.roomTypeId,
          checkIn: b.checkIn,
          checkOut: b.checkOut,
          excludeBookingId: b.id,
        });
        if (free.length === 0) fail('noRoom');
        room = free.find((r) => r.status === 'inspected' || r.status === 'clean') ?? fail('roomNotReady');
      }

      if (!room) fail('noRoom');
      if (room.status !== 'clean' && room.status !== 'inspected') fail('roomNotReady');

      await tx
        .update(bookings)
        .set({ status: 'checked_in', roomId: room.id, checkedInAt: new Date() })
        .where(eq(bookings.id, b.id));
      await ensureFolio(tx, b);
      await audit(tx, ctx, 'booking.checked_in', b.id, { room: room.number });
      return { room: room.number };
    });
  });
}

export async function checkOutBooking(input: unknown): Promise<ActionResult<{ balance: number }>> {
  return run(async () => {
    const ctx = await staff();
    const p = z.object({ bookingId: z.uuid(), force: z.boolean().default(false) }).parse(input);
    const today = todayIn(ctx.org.timezone);

    return db.transaction(async (tx) => {
      const b = await lockedBooking(tx, ctx.org.id, p.bookingId);
      if (b.status !== 'checked_in') fail('badStatus');

      const balance = round2(b.totalAmount + (await extrasFor(tx, ctx.org.id, b.id)) - b.paidAmount);
      if (balance > 0.009 && !(p.force && isManager(ctx))) fail('balanceDue');

      const early = b.checkOut > today && today > b.checkIn;
      await tx
        .update(bookings)
        .set({ status: 'checked_out', checkedOutAt: new Date(), checkOut: early ? today : b.checkOut })
        .where(eq(bookings.id, b.id));

      if (b.roomId) {
        await tx.update(rooms).set({ status: 'dirty' }).where(and(eq(rooms.orgId, ctx.org.id), eq(rooms.id, b.roomId)));
        const [nextArrival] = await tx
          .select({ id: bookings.id })
          .from(bookings)
          .where(
            and(
              eq(bookings.orgId, ctx.org.id),
              eq(bookings.roomId, b.roomId),
              eq(bookings.checkIn, today),
              inArray(bookings.status, ['tentative', 'confirmed']),
            ),
          )
          .limit(1);
        await tx.insert(housekeepingTasks).values({
          orgId: ctx.org.id,
          roomId: b.roomId,
          type: 'checkout_clean',
          priority: nextArrival ? 'urgent' : 'high',
          dueDate: today,
          notes: nextArrival ? (ctx.org.defaultLocale === 'en' ? 'Guest arriving today' : 'Mysafir mbërrin sot') : null,
        });
      }

      await tx
        .update(folios)
        .set({ status: 'closed', closedAt: new Date() })
        .where(and(eq(folios.orgId, ctx.org.id), eq(folios.bookingId, b.id), eq(folios.status, 'open')));

      await audit(tx, ctx, 'booking.checked_out', b.id, { balance, forced: balance > 0.009, early });
      return { balance };
    });
  });
}

export async function cancelBooking(input: unknown): Promise<ActionResult<{ refundable: number }>> {
  return run(async () => {
    const ctx = await staff();
    const p = z.object({ bookingId: z.uuid(), reason: z.string().trim().min(3).max(300) }).parse(input);
    return db.transaction(async (tx) => {
      const b = await lockedBooking(tx, ctx.org.id, p.bookingId);
      if (!['tentative', 'confirmed'].includes(b.status)) fail('badStatus');
      await tx
        .update(bookings)
        .set({ status: 'cancelled', cancelledAt: new Date(), cancelReason: p.reason })
        .where(eq(bookings.id, b.id));
      await audit(tx, ctx, 'booking.cancelled', b.id, { reason: p.reason });
      return { refundable: b.paidAmount };
    });
  });
}

export async function markNoShow(bookingId: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await staff();
    const id = idSchema.parse(bookingId);
    const today = todayIn(ctx.org.timezone);
    await db.transaction(async (tx) => {
      const b = await lockedBooking(tx, ctx.org.id, id);
      if (b.status !== 'confirmed') fail('badStatus');
      if (b.checkIn > today) fail('tooEarly');
      await tx.update(bookings).set({ status: 'no_show' }).where(eq(bookings.id, b.id));
      await audit(tx, ctx, 'booking.no_show', b.id);
    });
    return null;
  });
}

/* ───────────────────────── Money ───────────────────────── */

const paymentSchema = z.object({
  bookingId: z.uuid(),
  amount: z.coerce.number().positive().max(1_000_000),
  method: z.enum(['cash', 'card', 'bank_transfer', 'online']),
  refund: z.boolean().default(false),
  reference: z.string().trim().max(120).optional(),
});

export async function recordPayment(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const ctx = await staff();
    const p = paymentSchema.parse(input);
    if (p.refund && !isManager(ctx)) fail('forbidden');
    const amount = round2(p.amount);

    await db.transaction(async (tx) => {
      const b = await lockedBooking(tx, ctx.org.id, p.bookingId);
      if (p.refund && amount > b.paidAmount + 0.001) fail('refundTooLarge');
      if (!p.refund && ['cancelled', 'no_show'].includes(b.status) && !isManager(ctx)) fail('badStatus');

      const [folio] = await tx
        .select({ id: folios.id })
        .from(folios)
        .where(and(eq(folios.orgId, ctx.org.id), eq(folios.bookingId, b.id), eq(folios.status, 'open')))
        .limit(1);

      await tx.insert(payments).values({
        orgId: ctx.org.id,
        bookingId: b.id,
        folioId: folio?.id ?? null,
        amount,
        currency: b.currency,
        method: p.method,
        isDeposit: !p.refund && ['tentative', 'confirmed'].includes(b.status),
        isRefund: p.refund,
        reference: p.reference || null,
        receivedBy: ctx.user.id,
      });

      const delta = p.refund ? -amount : amount;
      await tx
        .update(bookings)
        .set({ paidAmount: sql`${bookings.paidAmount} + ${delta}` })
        .where(eq(bookings.id, b.id));

      await audit(tx, ctx, p.refund ? 'payment.refunded' : 'payment.recorded', b.id, { amount, method: p.method });
    });
    return null;
  });
}

const chargeSchema = z.object({
  bookingId: z.uuid(),
  type: z.enum(['restaurant', 'bar', 'pool_bar', 'room_service', 'spa', 'minibar', 'service', 'discount']),
  description: z.string().trim().min(2).max(160),
  quantity: z.coerce.number().min(0.001).max(999),
  unitPrice: z.coerce.number().min(0).max(100_000),
});

export async function postCharge(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const ctx = await staff();
    const p = chargeSchema.parse(input);
    if (p.type === 'discount' && !isManager(ctx)) fail('forbidden');

    await db.transaction(async (tx) => {
      const b = await lockedBooking(tx, ctx.org.id, p.bookingId);
      if (b.status !== 'checked_in') fail('notInHouse');
      const folioId = await ensureFolio(tx, b);
      const gross = round2(p.quantity * p.unitPrice);
      await tx.insert(folioItems).values({
        orgId: ctx.org.id,
        folioId,
        type: p.type,
        description: p.description,
        quantity: p.quantity,
        unitPrice: p.unitPrice,
        amount: p.type === 'discount' ? -gross : gross,
        postedBy: ctx.user.id,
      });
      await audit(tx, ctx, 'folio.charge_posted', b.id, { type: p.type, amount: gross });
    });
    return null;
  });
}

/** Reversal entry, never a delete: the folio stays auditable. */
export async function voidCharge(itemId: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await staff();
    if (!isManager(ctx)) fail('forbidden');
    const id = idSchema.parse(itemId);

    await db.transaction(async (tx) => {
      const [item] = await tx
        .select({ item: folioItems, folioStatus: folios.status, bookingId: folios.bookingId })
        .from(folioItems)
        .innerJoin(folios, eq(folios.id, folioItems.folioId))
        .where(and(eq(folioItems.orgId, ctx.org.id), eq(folioItems.id, id)))
        .limit(1)
        .for('update');
      if (!item) fail('notFound');
      if (item.folioStatus !== 'open') fail('badStatus');
      if (item.item.sourceRef?.startsWith('void:')) fail('badStatus');

      const [already] = await tx
        .select({ id: folioItems.id })
        .from(folioItems)
        .where(and(eq(folioItems.orgId, ctx.org.id), eq(folioItems.sourceRef, `void:${id}`)))
        .limit(1);
      if (already) fail('alreadyVoided');

      await tx.insert(folioItems).values({
        orgId: ctx.org.id,
        folioId: item.item.folioId,
        type: item.item.type,
        description: `↺ ${item.item.description}`,
        quantity: item.item.quantity,
        unitPrice: -item.item.unitPrice,
        amount: -item.item.amount,
        vatRate: item.item.vatRate,
        sourceRef: `void:${id}`,
        postedBy: ctx.user.id,
      });
      if (item.bookingId) await audit(tx, ctx, 'folio.charge_voided', item.bookingId, { amount: item.item.amount });
    });
    return null;
  });
}

/* ───────────────────────── Guests ───────────────────────── */

const guestUpdateSchema = z.object({
  guestId: z.uuid(),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(40).optional(),
  nationality: z.string().trim().max(56).optional(),
  isVip: z.boolean(),
  marketingConsent: z.boolean(),
  tags: z.string().max(300).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export async function updateGuest(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const ctx = await staff();
    const p = guestUpdateSchema.parse(input);
    const email = p.email ? p.email.toLowerCase() : null;
    if (email && !z.email().safeParse(email).success) fail('email');
    const tags = (p.tags ?? '')
      .split(',')
      .map((t) => t.trim().slice(0, 24))
      .filter(Boolean)
      .slice(0, 10);

    await db.transaction(async (tx) => {
      const updated = await tx
        .update(guests)
        .set({
          firstName: p.firstName,
          lastName: p.lastName,
          email,
          phone: normalizePhone(p.phone),
          nationality: p.nationality || null,
          isVip: p.isVip,
          marketingConsent: p.marketingConsent,
          tags,
          notes: p.notes || null,
        })
        .where(and(eq(guests.orgId, ctx.org.id), eq(guests.id, p.guestId)))
        .returning({ id: guests.id });
      if (updated.length === 0) fail('guestNotFound');
      await audit(tx, ctx, 'guest.updated', p.guestId, { vip: p.isVip }, 'guest');
    });
    return null;
  });
}
