'use server';

import { and, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { alerts, cashShifts, guests, invoiceLines, invoices, payments } from '@/db/schema';
import { getIntegration } from '@/lib/integrations/registry';
import { fiscalizeById, linesForFolio, linesForPosOrder, nextInvoiceNumber, totals } from '@/server/services/invoicing';
import { audit, fail, gate, MANAGERS, round2, run, type ActionResult } from './kit';

const INV_ROLES = ['owner', 'manager', 'receptionist', 'accountant'] as const;

const issueSchema = z
  .object({
    folioId: z.uuid().optional(),
    posOrderId: z.uuid().optional(),
    buyerName: z.string().trim().max(160).optional(),
    buyerNipt: z.string().trim().max(20).optional(),
    buyerAddress: z.string().trim().max(200).optional(),
    paymentMethod: z.enum(['cash', 'card', 'bank_transfer', 'online', 'room_charge']).optional(),
    fiscalize: z.boolean().default(true),
  })
  .refine((v) => Boolean(v.folioId) !== Boolean(v.posOrderId), { message: 'one source' });

export async function issueInvoice(input: unknown): Promise<ActionResult<{ id: string; status: string }>> {
  return run(async () => {
    const ctx = await gate(INV_ROLES, 'invoicing');
    const p = issueSchema.parse(input);

    const created = await db.transaction(async (tx) => {
      const source = p.folioId ? await linesForFolio(tx, ctx.org.id, p.folioId) : null;
      const pos = p.posOrderId ? await linesForPosOrder(tx, ctx.org.id, p.posOrderId) : null;
      const lines = source?.lines ?? pos?.lines ?? [];
      if (lines.length === 0) fail('emptyInvoice');

      // One live invoice per source.
      const dupe = await tx
        .select({ id: invoices.id })
        .from(invoices)
        .where(and(eq(invoices.orgId, ctx.org.id), sql`${invoices.status} <> 'cancelled'`, p.folioId ? eq(invoices.folioId, p.folioId) : eq(invoices.posOrderId, p.posOrderId!)))
        .limit(1);
      if (dupe.length) fail('alreadyInvoiced');

      let buyerName = p.buyerName || null;
      const guestId = source?.guestId ?? null;
      if (!buyerName && guestId) {
        const [g] = await tx.select({ f: guests.firstName, l: guests.lastName }).from(guests).where(eq(guests.id, guestId)).limit(1);
        buyerName = g ? `${g.f} ${g.l}` : null;
      }

      const t = totals(lines);
      const now = new Date();
      const number = await nextInvoiceNumber(tx, ctx.org.id, now.getFullYear());
      const [inv] = await tx
        .insert(invoices)
        .values({
          orgId: ctx.org.id, number, folioId: p.folioId ?? null, posOrderId: p.posOrderId ?? null, guestId, buyerName, buyerNipt: p.buyerNipt || null, buyerAddress: p.buyerAddress || null,
          issuedAt: now, subtotal: t.subtotal, vatTotal: t.vatTotal, total: t.total, currency: ctx.org.currency, paymentMethod: p.paymentMethod ?? pos?.order.paymentMethod ?? null, status: 'issued', issuedBy: ctx.user.id,
        })
        .returning();
      await tx.insert(invoiceLines).values(lines.map((l) => ({ orgId: ctx.org.id, invoiceId: inv!.id, ...l })));
      await audit(tx, ctx, 'invoice.issued', 'invoice', inv!.id, { number, total: t.total });
      return inv!;
    });

    let status = created.status as string;
    if (p.fiscalize && ctx.modules.has('fiscalization')) {
      const integ = await getIntegration(ctx.org.id, 'easypos');
      if (integ.enabled) {
        const done = await fiscalizeById(ctx.org, created.id);
        status = done.status;
      }
    }
    return { id: created.id, status };
  });
}

export async function fiscalizeInvoiceAction(invoiceId: string): Promise<ActionResult<{ status: string }>> {
  return run(async () => {
    const ctx = await gate(INV_ROLES, 'fiscalization');
    const inv = await fiscalizeById(ctx.org, z.uuid().parse(invoiceId));
    await audit(db, ctx, 'invoice.fiscalized', 'invoice', inv.id, { nivf: inv.nivf, provider: inv.fiscalProvider });
    return { status: inv.status };
  });
}

export async function cancelInvoice(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const ctx = await gate(MANAGERS, 'invoicing');
    const p = z.object({ invoiceId: z.uuid(), reason: z.string().trim().min(3).max(200) }).parse(input);
    const [inv] = await db
      .update(invoices)
      .set({ status: 'cancelled', cancelledAt: new Date(), cancelReason: p.reason })
      .where(and(eq(invoices.orgId, ctx.org.id), eq(invoices.id, p.invoiceId), sql`${invoices.status} <> 'cancelled'`))
      .returning({ id: invoices.id, total: invoices.total });
    if (!inv) fail('badStatus');
    await audit(db, ctx, 'invoice.cancelled', 'invoice', inv.id, { reason: p.reason, total: inv.total });
    // Cancelling a fiscalized invoice is a fraud signal worth surfacing.
    await db.insert(alerts).values({ orgId: ctx.org.id, type: 'invoice_cancelled', severity: 'info', title: 'Faturë e anuluar', body: p.reason, entityType: 'invoice', entityId: inv.id });
    return null;
  });
}

/* ───────────── Cash register ───────────── */

export async function openShift(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const ctx = await gate(['owner', 'manager', 'receptionist', 'pos'], undefined);
    const p = z.object({ openingCash: z.coerce.number().min(0).max(1_000_000) }).parse(input);
    const [open] = await db.select({ id: cashShifts.id }).from(cashShifts).where(and(eq(cashShifts.orgId, ctx.org.id), eq(cashShifts.userId, ctx.user.id), isNull(cashShifts.closedAt))).limit(1);
    if (open) fail('shiftOpen');
    const [s] = await db.insert(cashShifts).values({ orgId: ctx.org.id, userId: ctx.user.id, openingCash: p.openingCash }).returning({ id: cashShifts.id });
    await audit(db, ctx, 'cash_shift.opened', 'cash_shift', s!.id, { openingCash: p.openingCash });
    return null;
  });
}

export async function closeShift(input: unknown): Promise<ActionResult<{ difference: number; expected: number }>> {
  return run(async () => {
    const ctx = await gate(['owner', 'manager', 'receptionist', 'pos'], undefined);
    const p = z.object({ shiftId: z.uuid(), countedCash: z.coerce.number().min(0).max(10_000_000), notes: z.string().trim().max(300).optional() }).parse(input);

    return db.transaction(async (tx) => {
      const [s] = await tx.select().from(cashShifts).where(and(eq(cashShifts.orgId, ctx.org.id), eq(cashShifts.id, p.shiftId))).limit(1).for('update');
      if (!s || s.closedAt) fail('notFound');
      if (s.userId !== ctx.user.id && !MANAGERS.includes(ctx.role)) fail('forbidden');

      const [row] = await tx
        .select({ cash: sql<number>`coalesce(sum(case when ${payments.isRefund} then -${payments.amount} else ${payments.amount} end),0)`.mapWith(Number) })
        .from(payments)
        .where(and(eq(payments.orgId, ctx.org.id), eq(payments.method, 'cash'), eq(payments.receivedBy, s.userId), sql`${payments.receivedAt} >= ${s.openedAt}`));
      const expected = round2(s.openingCash + (row?.cash ?? 0));
      const difference = round2(p.countedCash - expected);
      await tx.update(cashShifts).set({ closedAt: new Date(), expectedCash: expected, countedCash: p.countedCash, difference, notes: p.notes ?? null }).where(eq(cashShifts.id, s.id));
      await audit(tx, ctx, 'cash_shift.closed', 'cash_shift', s.id, { difference, expected });
      if (Math.abs(difference) >= 1) {
        await tx.insert(alerts).values({
          orgId: ctx.org.id, type: 'cash_difference', severity: Math.abs(difference) >= 20 ? 'critical' : 'warning',
          title: `Diferencë arke: ${difference > 0 ? '+' : ''}${difference.toFixed(2)}`, body: `Pritej ${expected.toFixed(2)}, numëruar ${p.countedCash.toFixed(2)}`, entityType: 'cash_shift', entityId: s.id,
        });
      }
      return { difference, expected };
    });
  });
}
