import 'server-only';
import { and, asc, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { outlets, posOrderItems, posOrders, posTables, productCategories, products } from '@/db/schema';
import type { OrgContext } from '@/lib/auth/session';
import { todayIn } from '@/lib/dates';
import { localized } from '@/lib/utils';

export async function getPos(ctx: OrgContext, outletId: string | undefined, locale: string) {
  const orgId = ctx.org.id;
  const outletRows = await db
    .select()
    .from(outlets)
    .where(and(eq(outlets.orgId, orgId), eq(outlets.isActive, true), sql`${outlets.type} <> 'spa'`))
    .orderBy(asc(outlets.sortOrder));
  const outlet = outletRows.find((o) => o.id === outletId) ?? outletRows[0];
  if (!outlet) return { outlets: [], outlet: null, categories: [], products: [], tables: [], orders: [], stock: [], summary: [] };

  const todayStart = new Date(`${todayIn(ctx.org.timezone)}T00:00:00`);
  const [cats, prods, tables, openOrders, summary] = await Promise.all([
    db.select().from(productCategories).where(and(eq(productCategories.orgId, orgId), eq(productCategories.outletId, outlet.id))).orderBy(asc(productCategories.sortOrder)),
    db.select().from(products).where(and(eq(products.orgId, orgId), eq(products.outletId, outlet.id), eq(products.isActive, true))).orderBy(asc(products.sortOrder), asc(products.price)),
    db.select().from(posTables).where(and(eq(posTables.orgId, orgId), eq(posTables.outletId, outlet.id))).orderBy(asc(posTables.label)),
    db
      .select()
      .from(posOrders)
      .where(and(eq(posOrders.orgId, orgId), eq(posOrders.outletId, outlet.id), inArray(posOrders.status, ['open', 'sent', 'served'])))
      .orderBy(desc(posOrders.createdAt)),
    db
      .select({ method: posOrders.paymentMethod, n: sql<number>`count(*)`.mapWith(Number), total: sql<number>`coalesce(sum(${posOrders.total}),0)`.mapWith(Number) })
      .from(posOrders)
      .where(and(eq(posOrders.orgId, orgId), eq(posOrders.outletId, outlet.id), eq(posOrders.status, 'paid'), gte(posOrders.paidAt, todayStart)))
      .groupBy(posOrders.paymentMethod),
  ]);

  const items = openOrders.length
    ? await db.select().from(posOrderItems).where(and(eq(posOrderItems.orgId, orgId), inArray(posOrderItems.orderId, openOrders.map((o) => o.id))))
    : [];

  return {
    outlets: outletRows.map((o) => ({ id: o.id, type: o.type, name: localized(o.name, locale) })),
    outlet: { id: outlet.id, type: outlet.type, name: localized(outlet.name, locale) },
    categories: cats.map((c) => ({ id: c.id, name: localized(c.name, locale) })),
    products: prods.map((p) => ({ id: p.id, name: localized(p.name, locale), categoryId: p.categoryId, price: p.price, trackStock: p.trackStock, stockQty: p.stockQty, low: p.trackStock && p.lowStockThreshold !== null && p.stockQty <= p.lowStockThreshold })),
    tables: tables.map((t) => ({ id: t.id, label: t.label, seats: t.seats })),
    orders: openOrders.map((o) => ({
      id: o.id, tableId: o.tableId, status: o.status, covers: o.covers, notes: o.notes, subtotal: o.subtotal, discount: o.discount, total: o.total, createdAt: o.createdAt.toISOString(),
      items: items.filter((i) => i.orderId === o.id).map((i) => ({ productId: i.productId, name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, notes: i.notes })),
    })),
    stock: prods.filter((p) => p.trackStock).map((p) => ({ id: p.id, name: localized(p.name, locale), qty: p.stockQty, threshold: p.lowStockThreshold })),
    summary,
  };
}

export type PosData = Awaited<ReturnType<typeof getPos>>;
