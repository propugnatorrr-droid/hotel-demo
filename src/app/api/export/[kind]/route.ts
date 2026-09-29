import { and, desc, eq, gte, lt, lte } from 'drizzle-orm';
import { db } from '@/db';
import { auditLogs, bookings, expenses, guests, invoices, payments, profiles, rooms } from '@/db/schema';
import { requireOrg } from '@/lib/auth/session';
import { auditLabel } from '@/config/audit-labels';
import { addDays } from '@/lib/dates';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const KINDS = ['bookings', 'invoices', 'expenses', 'payments', 'activity'] as const;
type Kind = (typeof KINDS)[number];

const cell = (v: unknown) => {
  const s = v == null ? '' : v instanceof Date ? v.toISOString() : String(v);
  // Neutralise spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replaceAll('"', '""')}"`;
};
const csv = (header: string[], rows: unknown[][]) => `﻿${[header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')}\r\n`;

/** Excel-ready CSV exports. Owner / manager / accountant with the reports module. */
export async function GET(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!(KINDS as readonly string[]).includes(kind)) return new Response('Not found', { status: 404 });
  const ctx = await requireOrg();
  if (!ctx.modules.has('reports') || (!['owner', 'manager', 'accountant'].includes(ctx.role) && !ctx.profile.isSuperAdmin)) return new Response('Forbidden', { status: 403 });

  const q = new URL(request.url).searchParams;
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const from = iso.test(q.get('from') ?? '') ? q.get('from')! : addDays(new Date().toISOString().slice(0, 10), -30);
  const to = iso.test(q.get('to') ?? '') ? q.get('to')! : new Date().toISOString().slice(0, 10);
  const end = addDays(to, 1);
  const org = ctx.org.id;
  const locale = q.get('locale') === 'en' ? 'en' : 'sq';
  let body = '';

  switch (kind as Kind) {
    case 'bookings': {
      const r = await db
        .select({ b: bookings, g: guests, room: rooms.number })
        .from(bookings)
        .innerJoin(guests, eq(guests.id, bookings.guestId))
        .leftJoin(rooms, eq(rooms.id, bookings.roomId))
        .where(and(eq(bookings.orgId, org), gte(bookings.checkIn, from), lte(bookings.checkIn, to)))
        .orderBy(bookings.checkIn)
        .limit(20000);
      body = csv(['Code', 'Guest', 'Email', 'Phone', 'Check-in', 'Check-out', 'Room', 'Status', 'Source', 'Total', 'Paid', 'Commission', 'Currency'], r.map(({ b, g, room }) => [b.code, `${g.firstName} ${g.lastName}`, g.email, g.phone, b.checkIn, b.checkOut, room, b.status, b.source, b.totalAmount, b.paidAmount, b.commissionAmount, b.currency]));
      break;
    }
    case 'invoices': {
      const r = await db.select().from(invoices).where(and(eq(invoices.orgId, org), gte(invoices.issuedAt, new Date(`${from}T00:00:00Z`)), lt(invoices.issuedAt, new Date(`${end}T00:00:00Z`)))).orderBy(invoices.issuedAt).limit(20000);
      body = csv(['Number', 'Date', 'Buyer', 'Buyer NIPT', 'Net', 'VAT', 'Total', 'Currency', 'Status', 'NIVF', 'NSLF', 'Payment'], r.map((i) => [i.number, i.issuedAt, i.buyerName, i.buyerNipt, i.subtotal, i.vatTotal, i.total, i.currency, i.status, i.nivf, i.nslf, i.paymentMethod]));
      break;
    }
    case 'expenses': {
      const r = await db.select().from(expenses).where(and(eq(expenses.orgId, org), gte(expenses.expenseDate, from), lte(expenses.expenseDate, to))).orderBy(expenses.expenseDate).limit(20000);
      body = csv(['Date', 'Supplier', 'Supplier NIPT', 'Invoice', 'Category', 'Department', 'Amount', 'VAT', 'Currency', 'Payment', 'Description'], r.map((e) => [e.expenseDate, e.supplierName, e.supplierNipt, e.invoiceNumber, e.category, e.department, e.amount, e.vatAmount, e.currency, e.paymentMethod, e.description]));
      break;
    }
    case 'payments': {
      const r = await db.select().from(payments).where(and(eq(payments.orgId, org), gte(payments.receivedAt, new Date(`${from}T00:00:00Z`)), lt(payments.receivedAt, new Date(`${end}T00:00:00Z`)))).orderBy(payments.receivedAt).limit(20000);
      body = csv(['Date', 'Amount', 'Currency', 'Method', 'Refund', 'Deposit', 'Reference'], r.map((p) => [p.receivedAt, p.amount, p.currency, p.method, p.isRefund, p.isDeposit, p.reference]));
      break;
    }
    case 'activity': {
      const r = await db
        .select({ a: auditLogs, name: profiles.fullName })
        .from(auditLogs)
        .leftJoin(profiles, eq(profiles.id, auditLogs.userId))
        .where(and(eq(auditLogs.orgId, org), gte(auditLogs.createdAt, new Date(`${from}T00:00:00Z`)), lt(auditLogs.createdAt, new Date(`${end}T00:00:00Z`))))
        .orderBy(desc(auditLogs.createdAt))
        .limit(20000);
      body = csv(['Time', 'User', 'Action', 'Entity', 'Details'], r.map(({ a, name }) => [a.createdAt, name, auditLabel(a.action, locale), a.entityType, JSON.stringify(a.meta)]));
      break;
    }
  }

  return new Response(body, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${kind}-${from}-${to}.csv"`, 'Cache-Control': 'no-store' },
  });
}
