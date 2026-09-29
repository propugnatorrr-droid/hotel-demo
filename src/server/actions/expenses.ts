'use server';

import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { expenses } from '@/db/schema';
import { createAdminClient } from '@/lib/supabase/admin';
import { audit, fail, gate, MANAGERS, run, type ActionResult } from './kit';

const ROLES = ['owner', 'manager', 'accountant'] as const;
const dept = z.enum(['rooms', 'restaurant', 'bar', 'spa', 'maintenance', 'marketing', 'admin', 'staff', 'other']);

const expenseSchema = z.object({
  id: z.uuid().optional(),
  supplierName: z.string().trim().min(2).max(160),
  supplierNipt: z.string().trim().max(20).optional(),
  invoiceNumber: z.string().trim().max(40).optional(),
  category: z.string().trim().min(2).max(60),
  department: dept,
  description: z.string().trim().max(200).optional(),
  amount: z.coerce.number().positive().max(100_000_000),
  vatAmount: z.coerce.number().min(0).max(100_000_000).default(0),
  currency: z.enum(['ALL', 'EUR', 'USD']),
  expenseDate: z.iso.date(),
  paymentMethod: z.enum(['cash', 'card', 'bank_transfer', 'online']).optional(),
  receiptPath: z.string().max(200).optional(),
  ocrData: z.record(z.string(), z.unknown()).optional(),
  ocrConfidence: z.coerce.number().min(0).max(1).optional(),
});

export async function saveExpense(input: unknown): Promise<ActionResult<{ id: string }>> {
  return run(async () => {
    const ctx = await gate(ROLES, 'expenses');
    const p = expenseSchema.parse(input);
    // Receipt paths must belong to this org's folder.
    if (p.receiptPath && !p.receiptPath.startsWith(`${ctx.org.id}/`)) fail('invalid');
    const values = {
      supplierName: p.supplierName, supplierNipt: p.supplierNipt || null, invoiceNumber: p.invoiceNumber || null, category: p.category, department: p.department,
      description: p.description || null, amount: p.amount, vatAmount: p.vatAmount, currency: p.currency, expenseDate: p.expenseDate, paymentMethod: p.paymentMethod ?? null,
      ...(p.receiptPath ? { receiptPath: p.receiptPath } : {}), ...(p.ocrData ? { ocrData: p.ocrData, ocrConfidence: p.ocrConfidence ?? null } : {}),
    };
    if (p.id) {
      const [e] = await db.update(expenses).set(values).where(and(eq(expenses.orgId, ctx.org.id), eq(expenses.id, p.id))).returning({ id: expenses.id });
      if (!e) fail('notFound');
      await audit(db, ctx, 'expense.updated', 'expense', e.id, { amount: p.amount });
      return { id: e.id };
    }
    const [e] = await db.insert(expenses).values({ orgId: ctx.org.id, createdBy: ctx.user.id, ...values }).returning({ id: expenses.id });
    await audit(db, ctx, 'expense.created', 'expense', e!.id, { amount: p.amount, ocr: Boolean(p.ocrData) });
    return { id: e!.id };
  });
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await gate(MANAGERS, 'expenses');
    const [e] = await db.delete(expenses).where(and(eq(expenses.orgId, ctx.org.id), eq(expenses.id, z.uuid().parse(id)))).returning({ id: expenses.id, amount: expenses.amount });
    if (!e) fail('notFound');
    await audit(db, ctx, 'expense.deleted', 'expense', e.id, { amount: e.amount });
    return null;
  });
}

/** Short-lived signed URL for a private receipt image. */
export async function getReceiptUrl(id: string): Promise<ActionResult<{ url: string }>> {
  return run(async () => {
    const ctx = await gate(ROLES, 'expenses');
    const [e] = await db.select({ path: expenses.receiptPath }).from(expenses).where(and(eq(expenses.orgId, ctx.org.id), eq(expenses.id, z.uuid().parse(id)))).limit(1);
    if (!e?.path) fail('notFound');
    const { data, error } = await createAdminClient().storage.from('receipts').createSignedUrl(e.path, 90);
    if (error || !data) fail('unknown');
    return { url: data.signedUrl };
  }, false);
}
