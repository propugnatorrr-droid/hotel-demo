'use server';

import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import {
  alerts, bookings, cashShifts, folioItems, folios, guests, outlets, payments, posOrderItems, posOrders, posTables, products, rooms,
} from '@/db/schema';
import { audit, fail, gate, isManager, round2, run, type ActionResult, type Ctx, type Tx } from './kit';

const POS_ROLES = ['owner', 'manager', 'pos', 'receptionist'] as const;
const DISCOUNT_STAFF_LIMIT = 15; // percent; above this a manager must approve

const FOLIO_TYPE = { restaurant: 'restaurant', bar: 'bar', pool_bar: 'pool_bar', room_service: 'room_service', spa: 'spa' } as const;

async function loadOrder(tx: Tx, ctx: Ctx, orderId: string, lock = false) {
  const base = tx.select().from(posOrders).where(and(eq(posOrders.orgId, ctx.org.id), eq(posOrders.id, orderId))).limit(1);
  const [o] = lock ? await base.for('update') : await base;
  if (!o) fail('notFound');
  return o;
}

const itemSchema = z.object({ productId: z.uuid(), quantity: z.coerce.number().min(0.001).max(99), notes: z.string().trim().max(200).optional() });

/** Creates or replaces an open order. Prices are always read from the database. */
export async function saveOrder(input: unknown): Promise<ActionResult<{ orderId: string; total: number; subtotal: number }>> {
  return run(async () => {
    const ctx = await gate(POS_ROLES, 'pos');
    const p = z
      .object({
        orderId: z.uuid().optional(),
        outletId: z.uuid(),
        tableId: z.uuid().nullable().optional(),
        covers: z.coerce.number().int().min(1).max(40).optional(),
        items: z.array(itemSchema).max(80),
        discountPct: z.coerce.number().min(0).max(100).default(0),
        notes: z.string().trim().max(300).optional(),
        send: z.boolean().default(false),
      })
      .parse(input);

    return db.transaction(async (tx) => {
      const [outlet] = await tx.select().from(outlets).where(and(eq(outlets.orgId, ctx.org.id), eq(outlets.id, p.outletId), eq(outlets.isActive, true))).limit(1);
      if (!outlet || outlet.type === 'spa') fail('notFound');
      if (p.tableId) {
        const [t] = await tx.select({ id: posTables.id }).from(posTables).where(and(eq(posTables.orgId, ctx.org.id), eq(posTables.id, p.tableId), eq(posTables.outletId, outlet.id))).limit(1);
        if (!t) fail('notFound');
      }

      const ids = [...new Set(p.items.map((i) => i.productId))];
      const prods = ids.length ? await tx.select().from(products).where(and(eq(products.orgId, ctx.org.id), eq(products.outletId, outlet.id), eq(products.isActive, true), inArray(products.id, ids))) : [];
      const byId = new Map(prods.map((x) => [x.id, x]));
      if (prods.length !== ids.length) fail('badProduct');

      const lines = p.items.map((i) => {
        const prod = byId.get(i.productId)!;
        return { prod, quantity: i.quantity, notes: i.notes ?? null, amount: round2(prod.price * i.quantity) };
      });
      const subtotal = round2(lines.reduce((s, l) => s + l.amount, 0));
      if (p.discountPct > DISCOUNT_STAFF_LIMIT && !isManager(ctx)) fail('discountLimit');
      const discount = round2((subtotal * p.discountPct) / 100);
      const total = round2(subtotal - discount);

      let orderId = p.orderId;
      if (orderId) {
        const o = await loadOrder(tx, ctx, orderId, true);
        if (!['open', 'sent'].includes(o.status)) fail('badStatus');
        await tx
          .update(posOrders)
          .set({ tableId: p.tableId ?? null, covers: p.covers ?? null, subtotal, discount, total, notes: p.notes ?? null, ...(p.send ? { status: 'sent' as const } : {}) })
          .where(eq(posOrders.id, o.id));
        await tx.delete(posOrderItems).where(eq(posOrderItems.orderId, o.id));
      } else {
        const [o] = await tx
          .insert(posOrders)
          .values({ orgId: ctx.org.id, outletId: outlet.id, tableId: p.tableId ?? null, covers: p.covers ?? null, subtotal, discount, total, notes: p.notes ?? null, openedBy: ctx.user.id, status: p.send ? 'sent' : 'open' })
          .returning({ id: posOrders.id });
        orderId = o!.id;
      }
      if (lines.length) {
        await tx.insert(posOrderItems).values(lines.map((l) => ({ orgId: ctx.org.id, orderId: orderId!, productId: l.prod.id, name: l.prod.name.sq, quantity: l.quantity, unitPrice: l.prod.price, vatRate: l.prod.vatRate, notes: l.notes })));
      }
      if (p.discountPct > 0) await audit(tx, ctx, 'pos.discount_applied', 'pos_order', orderId, { percent: p.discountPct, amount: discount });
      return { orderId: orderId!, total, subtotal };
    });
  });
}

export async function payOrder(input: unknown): Promise<ActionResult<{ method: string; total: number }>> {
  return run(async () => {
    const ctx = await gate(POS_ROLES, 'pos');
    const p = z.object({ orderId: z.uuid(), method: z.enum(['cash', 'card', 'room_charge']), bookingId: z.uuid().optional() }).parse(input);

    return db.transaction(async (tx) => {
      const o = await loadOrder(tx, ctx, p.orderId, true);
      if (!['open', 'sent', 'served'].includes(o.status)) fail('badStatus');
      const items = await tx.select().from(posOrderItems).where(eq(posOrderItems.orderId, o.id));
      if (items.length === 0) fail('emptyOrder');
      const [outlet] = await tx.select().from(outlets).where(eq(outlets.id, o.outletId)).limit(1);
      if (!outlet) fail('notFound');

      let folioId: string | null = null;
      let bookingId: string | null = null;
      if (p.method === 'room_charge') {
        if (!p.bookingId) fail('bookingRequired');
        const [b] = await tx.select().from(bookings).where(and(eq(bookings.orgId, ctx.org.id), eq(bookings.id, p.bookingId), eq(bookings.status, 'checked_in'))).limit(1);
        if (!b) fail('notInHouse');
        let [f] = await tx.select({ id: folios.id }).from(folios).where(and(eq(folios.orgId, ctx.org.id), eq(folios.bookingId, b.id), eq(folios.status, 'open'))).limit(1);
        if (!f) [f] = await tx.insert(folios).values({ orgId: ctx.org.id, bookingId: b.id, guestId: b.guestId, currency: b.currency }).returning({ id: folios.id });
        folioId = f!.id;
        bookingId = b.id;
        // Discount is spread proportionally so the folio total equals the order total.
        const ratio = o.subtotal > 0 ? o.total / o.subtotal : 1;
        await tx.insert(folioItems).values(
          items.map((i) => ({
            orgId: ctx.org.id, folioId: folioId!, type: FOLIO_TYPE[outlet.type], description: i.name, quantity: i.quantity,
            unitPrice: round2(i.unitPrice * ratio), amount: round2(i.unitPrice * i.quantity * ratio), vatRate: i.vatRate, outletId: outlet.id, sourceRef: `pos:${o.id}`, postedBy: ctx.user.id,
          })),
        );
      } else {
        const [shift] = await tx.select({ id: cashShifts.id }).from(cashShifts).where(and(eq(cashShifts.orgId, ctx.org.id), eq(cashShifts.userId, ctx.user.id), isNull(cashShifts.closedAt))).orderBy(desc(cashShifts.openedAt)).limit(1);
        await tx.insert(payments).values({ orgId: ctx.org.id, posOrderId: o.id, shiftId: shift?.id ?? null, amount: o.total, currency: ctx.org.currency, method: p.method, receivedBy: ctx.user.id });
      }

      await tx.update(posOrders).set({ status: 'paid', paymentMethod: p.method, paidAt: new Date(), folioId, bookingId }).where(eq(posOrders.id, o.id));

      // Stock: decrement tracked products and raise a low-stock alert once.
      for (const i of items) {
        if (!i.productId) continue;
        const [prod] = await tx
          .update(products)
          .set({ stockQty: sql`${products.stockQty} - ${i.quantity}` })
          .where(and(eq(products.id, i.productId), eq(products.trackStock, true)))
          .returning();
        if (prod && prod.lowStockThreshold !== null && prod.stockQty <= prod.lowStockThreshold) {
          const [existing] = await tx.select({ id: alerts.id }).from(alerts).where(and(eq(alerts.orgId, ctx.org.id), eq(alerts.type, 'low_stock'), eq(alerts.entityId, prod.id), isNull(alerts.resolvedAt))).limit(1);
          if (!existing) {
            await tx.insert(alerts).values({ orgId: ctx.org.id, type: 'low_stock', severity: prod.stockQty <= 0 ? 'critical' : 'warning', title: `Stok i ulët: ${prod.name.sq}`, body: `Mbeten ${prod.stockQty}`, entityType: 'product', entityId: prod.id });
          }
        }
      }
      await audit(tx, ctx, 'pos.order_paid', 'pos_order', o.id, { method: p.method, total: o.total });
      return { method: p.method, total: o.total };
    });
  });
}

export async function voidOrder(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const ctx = await gate(POS_ROLES, 'pos');
    const p = z.object({ orderId: z.uuid(), reason: z.string().trim().min(3).max(200) }).parse(input);
    await db.transaction(async (tx) => {
      const o = await loadOrder(tx, ctx, p.orderId, true);
      if (o.status === 'void') fail('badStatus');
      // Paid orders can only be voided by a manager; open ones by whoever opened them.
      if (o.status === 'paid' && !isManager(ctx)) fail('forbidden');
      if (o.status !== 'paid' && o.openedBy !== ctx.user.id && !isManager(ctx)) fail('forbidden');
      await tx.update(posOrders).set({ status: 'void', voidedAt: new Date(), voidReason: p.reason }).where(eq(posOrders.id, o.id));
      if (o.status === 'paid') {
        await tx.delete(folioItems).where(and(eq(folioItems.orgId, ctx.org.id), eq(folioItems.sourceRef, `pos:${o.id}`)));
        await tx.update(payments).set({ isRefund: true }).where(eq(payments.posOrderId, o.id));
      }
      await audit(tx, ctx, 'pos.order_voided', 'pos_order', o.id, { reason: p.reason, wasPaid: o.status === 'paid', total: o.total });
    });
    return null;
  });
}

export async function adjustStock(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const ctx = await gate(['owner', 'manager', 'pos'], 'pos');
    const p = z.object({ productId: z.uuid(), delta: z.coerce.number().min(-10000).max(10000), reason: z.string().trim().max(120).optional() }).parse(input);
    const [prod] = await db
      .update(products)
      .set({ stockQty: sql`${products.stockQty} + ${p.delta}`, trackStock: true })
      .where(and(eq(products.orgId, ctx.org.id), eq(products.id, p.productId)))
      .returning({ id: products.id, stockQty: products.stockQty, threshold: products.lowStockThreshold });
    if (!prod) fail('notFound');
    if (prod.threshold === null || prod.stockQty > prod.threshold) {
      await db.update(alerts).set({ resolvedAt: new Date(), resolvedBy: ctx.user.id }).where(and(eq(alerts.orgId, ctx.org.id), eq(alerts.type, 'low_stock'), eq(alerts.entityId, prod.id), isNull(alerts.resolvedAt)));
    }
    await audit(db, ctx, 'pos.stock_adjusted', 'product', prod.id, { delta: p.delta, reason: p.reason ?? null });
    return null;
  });
}

/** Room number → in-house booking lookup for the "charge to room" picker. */
export async function findInHouse(query: string): Promise<ActionResult<{ id: string; room: string; guest: string; code: string }[]>> {
  return run(async () => {
    const ctx = await gate(POS_ROLES, 'pos');
    const q = z.string().trim().max(60).parse(query);
    const rows = await db
      .select({ id: bookings.id, room: rooms.number, first: guests.firstName, last: guests.lastName, code: bookings.code })
      .from(bookings)
      .innerJoin(rooms, eq(rooms.id, bookings.roomId))
      .innerJoin(guests, eq(guests.id, bookings.guestId))
      .where(and(eq(bookings.orgId, ctx.org.id), eq(bookings.status, 'checked_in'), q ? sql`(${rooms.number} ilike ${`${q.replace(/[%_\\]/g, '\\$&')}%`} or ${guests.lastName} ilike ${`%${q.replace(/[%_\\]/g, '\\$&')}%`})` : undefined))
      .orderBy(rooms.number)
      .limit(12);
    return rows.map((r) => ({ id: r.id, room: r.room, guest: `${r.first} ${r.last}`, code: r.code }));
  }, false);
}
