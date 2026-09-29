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
    if (mutate) revalidatePath('/[locale]/app', 'layout');
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

      cons
