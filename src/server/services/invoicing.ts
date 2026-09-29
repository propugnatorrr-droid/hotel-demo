import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { bookings, folioItems, folios, invoiceLines, invoices, organizations, posOrderItems, posOrders, rooms } from '@/db/schema';
import { fiscalizeInvoice } from '@/lib/integrations/fiscal';
import { getIntegration } from '@/lib/integrations/registry';
import { ActionError, round2, type Tx } from '@/server/actions/kit';
import { diffDays } from '@/lib/dates';

type Org = typeof organizations.$inferSelect;
export type Line = { description: string; quantity: number; unitPrice: number; vatRate: number; amount: number };

/** Prices are VAT-inclusive (hotel practice). vat = gross − gross / (1 + rate). */
export const vatOf = (gross: number, rate: number) => round2(gross - gross / (1 + rate / 100));

export function totals(lines: Line[]) {
  const total = round2(lines.reduce((s, l) => s + l.amount, 0));
  const vatTotal = round2(lines.reduce((s, l) => s + vatOf(l.amount, l.vatRate), 0));
  return { total, vatTotal, subtotal: round2(total - vatTotal) };
}

/** Accommodation line + every folio charge (skips reversal-cancelled pairs by netting amounts). */
export async function linesForFolio(tx: Tx, orgId: string, folioId: string) {
  const [f] = await tx.select().from(folios).where(and(eq(folios.orgId, orgId), eq(folios.id, folioId))).limit(1);
  if (!f) throw new ActionError('notFound');
  const lines: Line[] = [];
  let bookingId: string | null = f.bookingId;
  let guestId: string | null = f.guestId;

  if (f.bookingId) {
    const [b] = await tx
      .select({ b: bookings, room: rooms.number })
      .from(bookings)
      .leftJoin(rooms, eq(rooms.id, bookings.roomId))
      .where(and(eq(bookings.orgId, orgId), eq(bookings.id, f.bookingId)))
      .limit(1);
    if (b) {
      const n = Math.max(1, diffDays(b.b.checkOut, b.b.checkIn));
      lines.push({ description: `Akomodim · ${n} net${b.room ? ` · Dhoma ${b.room}` : ''}`, quantity: n, unitPrice: round2(b.b.totalAmount / n), vatRate: 6, amount: b.b.totalAmount });
      guestId = b.b.guestId;
    }
  }
  const items = await tx.select().from(folioItems).where(and(eq(folioItems.orgId, orgId), eq(folioItems.folioId, f.id)));
  for (const i of items) {
    if (i.amount === 0) continue;
    lines.push({ description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, vatRate: i.vatRate, amount: i.amount });
  }
  return { lines, folio: f, bookingId, guestId };
}

export async function linesForPosOrder(tx: Tx, orgId: string, orderId: string) {
  const [o] = await tx.select().from(posOrders).where(and(eq(posOrders.orgId, orgId), eq(posOrders.id, orderId))).limit(1);
  if (!o) throw new ActionError('notFound');
  const items = await tx.select().from(posOrderItems).where(eq(posOrderItems.orderId, o.id));
  const ratio = o.subtotal > 0 ? o.total / o.subtotal : 1;
  const lines: Line[] = items.map((i) => ({ description: i.name, quantity: i.quantity, unitPrice: round2(i.unitPrice * ratio), vatRate: i.vatRate, amount: round2(i.unitPrice * i.quantity * ratio) }));
  return { lines, order: o };
}

/** Sequential per-org number `N/YYYY`, serialized with an advisory lock. */
export async function nextInvoiceNumber(tx: Tx, orgId: string, year: number) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`invoice:${orgId}`}, 0))`);
  const [row] = await tx
    .select({ max: sql<number>`coalesce(max(split_part(${invoices.number}, '/', 1)::int), 0)`.mapWith(Number) })
    .from(invoices)
    .where(and(eq(invoices.orgId, orgId), sql`${invoices.number} like ${`%/${year}`}`));
  return `${(row?.max ?? 0) + 1}/${year}`;
}

export async function fiscalizeById(org: Org, invoiceId: string) {
  const [inv] = await db.select().from(invoices).where(and(eq(invoices.orgId, org.id), eq(invoices.id, invoiceId))).limit(1);
  if (!inv) throw new ActionError('notFound');
  if (inv.status === 'cancelled') throw new ActionError('badStatus');
  if (inv.status === 'fiscalized') return inv;
  const lines = await db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, inv.id));

  try {
    const r = await fiscalizeInvoice({
      orgId: org.id,
      seller: { name: org.legalName ?? org.name, nipt: org.nipt, address: org.address },
      invoice: { number: inv.number, issuedAt: inv.issuedAt, total: inv.total, vatTotal: inv.vatTotal, currency: inv.currency, buyerName: inv.buyerName, buyerNipt: inv.buyerNipt, paymentMethod: inv.paymentMethod },
      lines: lines.map((l) => ({ description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, vatRate: l.vatRate, amount: l.amount })),
    });
    const [updated] = await db
      .update(invoices)
      .set({ status: 'fiscalized', nivf: r.nivf, nslf: r.nslf, qrUrl: r.qrUrl, fiscalProvider: r.provider, fiscalResponse: r.response })
      .where(eq(invoices.id, inv.id))
      .returning();
    return updated!;
  } catch (e) {
    await db.update(invoices).set({ status: 'failed', fiscalResponse: { error: e instanceof Error ? e.message : 'failed' } }).where(eq(invoices.id, inv.id));
    throw new ActionError('fiscalFailed');
  }
}

export async function autoFiscalize(orgId: string) {
  const f = await getIntegration(orgId, 'easypos');
  return f.enabled;
}

