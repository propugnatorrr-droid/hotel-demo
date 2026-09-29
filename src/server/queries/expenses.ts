import 'server-only';
import { and, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { db } from '@/db';
import { expenses, profiles } from '@/db/schema';
import type { department } from '@/db/schema/enums';
import type { OrgContext } from '@/lib/auth/session';
import { addDays } from '@/lib/dates';
import { escapeLike } from '@/server/queries/bookings';

type Dept = (typeof department.enumValues)[number];

export async function listExpenses(ctx: OrgContext, month: string, dept: string, q: string) {
  const from = `${month}-01`;
  const [y, m] = month.split('-').map(Number) as [number, number];
  const to = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const where = [eq(expenses.orgId, ctx.org.id), gte(expenses.expenseDate, from), lt(expenses.expenseDate, to)];
  if (dept !== 'all') where.push(eq(expenses.department, dept as Dept));
  if (q) where.push(sql`(${expenses.supplierName} ilike ${`%${escapeLike(q)}%`} or ${expenses.description} ilike ${`%${escapeLike(q)}%`} or ${expenses.invoiceNumber} ilike ${`%${escapeLike(q)}%`})`);
  const rows = await db
    .select({ e: expenses, by: profiles.fullName })
    .from(expenses)
    .leftJoin(profiles, eq(profiles.id, expenses.createdBy))
    .where(and(...where))
    .orderBy(desc(expenses.expenseDate), desc(expenses.createdAt))
    .limit(300);
  return rows.map(({ e, by }) => ({
    id: e.id, supplier: e.supplierName, nipt: e.supplierNipt, invoiceNumber: e.invoiceNumber, category: e.category, department: e.department, description: e.description,
    amount: e.amount, vat: e.vatAmount, currency: e.currency, date: e.expenseDate, method: e.paymentMethod, hasReceipt: Boolean(e.receiptPath), ocr: e.ocrData !== null, confidence: e.ocrConfidence, by,
  }));
}

export type ExpenseRow = Awaited<ReturnType<typeof listExpenses>>[number];
void addDays;
