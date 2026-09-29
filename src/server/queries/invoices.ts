import 'server-only';
import { and, desc, eq, exists, isNull, notExists, sql } from 'drizzle-orm';
import QRCode from 'qrcode';
import { db } from '@/db';
import { bookings, cashShifts, folios, guests, invoiceLines, invoices, payments, posOrders, profiles, rooms } from '@/db/schema';
import type { invoiceStatus } from '@/db/schema/enums';
import type { OrgContext } from '@/lib/auth/session';
import { escapeLike } from '@/server/queries/bookings';

export type InvoiceStatus = (typeof invoiceStatus.enumValues)[number];
export const INVOICE_STATUSES = ['all', 'fiscalized', 'issued', 'failed', 'cancelled'] as const;

export async function listInvoices(ctx: OrgContext, status: string, q: string) {
  const where = [eq(invoices.orgId, ctx.org.id)];
  if (status !== 'all') where.push(eq(invoices.status, status as InvoiceStatus));
  if (q) where.push(sql`(${invoices.number} ilike ${`%${escapeLike(q)}%`} or ${invoices.buyerName} ilike ${`%${escapeLike(q)}%`} or ${invoices.nivf} ilike ${`%${escapeLike(q)}%`})`);
  const rows = await db
    .select({ id: invoices.id, number: invoices.number, issuedAt: invoices.issuedAt, buyerName: invoices.buyerName, total: invoices.total, vatTotal: invoices.vatTotal, status: invoices.status, nivf: invoices.nivf, nslf: invoices.nslf, method: invoices.paymentMethod, provider: invoices.fiscalProvider })
    .from(invoices)
    .where(and(...where))
    .orderBy(desc(invoices.issuedAt))
    .limit(150);
  return rows.map((r) => ({ ...r, issuedAt: r.issuedAt.toISOString() }));
}

export async function getInvoiceCounts(ctx: OrgContext) {
  const rows = await db.select({ status: invoices.status, n: sql<number>`count(*)`.mapWith(Number) }).from(invoices).where(eq(invoices.orgId, ctx.org.id)).groupBy(invoices.status);
  const by = Object.fromEntries(rows.map((r) => [r.status, r.n]));
  return { all: rows.reduce((s, r) => s + r.n, 0), fiscalized: by.fiscalized ?? 0, issued: by.issued ?? 0, failed: by.failed ?? 0, cancelled: by.cancelled ?? 0 } as Record<(typeof INVOICE_STATUSES)[number], number>;
}

export async function getInvoice(ctx: OrgContext, id: string | undefined) {
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [inv] = await db.select().from(invoices).where(and(eq(invoices.orgId, ctx.org.id), eq(invoices.id, id))).limit(1);
  if (!inv) return null;
  const lines = await db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, inv.id));
  const qr = inv.qrUrl ? await QRCode.toDataURL(inv.qrUrl, { margin: 1, width: 240, errorCorrectionLevel: 'M' }) : null;
  const vatBy = new Map<number, { base: number; vat: number }>();
  for (const l of lines) {
    const vat = Math.round((l.amount - l.amount / (1 + l.vatRate / 100)) * 100) / 100;
    const cur = vatBy.get(l.vatRate) ?? { base: 0, vat: 0 };
    vatBy.set(l.vatRate, { base: cur.base + (l.amount - vat), vat: cur.vat + vat });
  }
  return {
    ...inv,
    issuedAt: inv.issuedAt.toISOString(),
    cancelledAt: inv.cancelledAt?.toISOString() ?? null,
    lines,
    qr,
    vatBreakdown: [...vatBy.entries()].map(([rate, v]) => ({ rate, base: Math.round(v.base * 100) / 100, vat: Math.round(v.vat * 100) / 100 })),
    seller: { name: ctx.org.legalName ?? ctx.org.name, nipt: ctx.org.nipt, address: [ctx.org.address, ctx.org.city].filter(Boolean).join(', '), phone: ctx.org.phone, email: ctx.org.email },
  };
}

/** Folios and paid POS orders that still lack a live invoice. */
export async function getInvoiceable(ctx: OrgContext) {
  const noInvoice = (col: typeof invoices.folioId | typeof invoices.posOrderId, ref: unknown) =>
    notExists(db.select({ x: sql`1` }).from(invoices).where(and(eq(invoices.orgId, ctx.org.id), eq(col, ref as never), sql`${invoices.status} <> 'cancelled'`)));

  const [fol, pos] = await Promise.all([
    db
      .select({ id: folios.id, status: folios.status, first: guests.firstName, last: guests.lastName, room: rooms.number, code: bookings.code })
      .from(folios)
      .innerJoin(bookings, eq(bookings.id, folios.bookingId))
      .innerJoin(guests, eq(guests.id, bookings.guestId))
      .leftJoin(rooms, eq(rooms.id, bookings.roomId))
      .where(and(eq(folios.orgId, ctx.org.id), eq(folios.status, 'closed'), noInvoice(invoices.folioId, folios.id)))
      .orderBy(desc(folios.closedAt))
      .limit(40),
    db
      .select({ id: posOrders.id, total: posOrders.total, paidAt: posOrders.paidAt, method: posOrders.paymentMethod })
      .from(posOrders)
      .where(and(eq(posOrders.orgId, ctx.org.id), eq(posOrders.status, 'paid'), sql`${posOrders.paymentMethod} in ('cash','card')`, noInvoice(invoices.posOrderId, posOrders.id)))
      .orderBy(desc(posOrders.paidAt))
      .limit(30),
  ]);
  return {
    folios: fol.map((f) => ({ id: f.id, label: `${f.room ? `${f.room} · ` : ''}${f.first} ${f.last} · ${f.code}` })),
    pos: pos.map((o) => ({ id: o.id, total: o.total, paidAt: o.paidAt?.toISOString() ?? null, method: o.method })),
  };
}

export async function getCash(ctx: OrgContext) {
  const [mine, recent] = await Promise.all([
    db.select().from(cashShifts).where(and(eq(cashShifts.orgId, ctx.org.id), eq(cashShifts.userId, ctx.user.id), isNull(cashShifts.closedAt))).limit(1),
    db
      .select({ id: cashShifts.id, openedAt: cashShifts.openedAt, closedAt: cashShifts.closedAt, opening: cashShifts.openingCash, expected: cashShifts.expectedCash, counted: cashShifts.countedCash, diff: cashShifts.difference, name: profiles.fullName })
      .from(cashShifts)
      .leftJoin(profiles, eq(profiles.id, cashShifts.userId))
      .where(eq(cashShifts.orgId, ctx.org.id))
      .orderBy(desc(cashShifts.openedAt))
      .limit(20),
  ]);
  let running = 0;
  const open = mine[0];
  if (open) {
    const [row] = await db
      .select({ cash: sql<number>`coalesce(sum(case when ${payments.isRefund} then -${payments.amount} else ${payments.amount} end),0)`.mapWith(Number) })
      .from(payments)
      .where(and(eq(payments.orgId, ctx.org.id), eq(payments.method, 'cash'), eq(payments.receivedBy, ctx.user.id), sql`${payments.receivedAt} >= ${open.openedAt}`));
    running = row?.cash ?? 0;
  }
  return {
    open: open ? { id: open.id, openedAt: open.openedAt.toISOString(), opening: open.openingCash, running } : null,
    recent: recent.map((s) => ({ ...s, openedAt: s.openedAt.toISOString(), closedAt: s.closedAt?.toISOString() ?? null })),
  };
}

export type InvoiceRow = Awaited<ReturnType<typeof listInvoices>>[number];
export type InvoiceDetail = NonNullable<Awaited<ReturnType<typeof getInvoice>>>;
export type Invoiceable = Awaited<ReturnType<typeof getInvoiceable>>;
export type CashData = Awaited<ReturnType<typeof getCash>>;
void exists;
