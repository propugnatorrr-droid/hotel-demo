import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { ExpensesView } from '@/components/app/expenses/expenses-view';
import { DEPARTMENTS } from '@/config/expenses';
import { requireOrg } from '@/lib/auth/session';
import { todayIn } from '@/lib/dates';
import { listExpenses } from '@/server/queries/expenses';
import { getProfit } from '@/server/queries/finance';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ month?: string; dept?: string; q?: string }> };

export default async function ExpensesPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireOrg();
  if (!ctx.modules.has('expenses') || (!['owner', 'manager', 'accountant'].includes(ctx.role) && !ctx.profile.isSuperAdmin)) notFound();

  const today = todayIn(ctx.org.timezone);
  const sp = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(sp.month ?? '') ? (sp.month as string) : today.slice(0, 7);
  const dept = (DEPARTMENTS as string[]).includes(sp.dept ?? '') ? (sp.dept as string) : 'all';
  const q = (sp.q ?? '').slice(0, 80);

  const [rows, profit] = await Promise.all([listExpenses(ctx, month, dept, q), getProfit(ctx, 6)]);
  return <ExpensesView rows={rows} month={month} dept={dept} q={q} profit={profit.months} fx={profit.fx} locale={locale} currency={ctx.org.currency} manager={['owner', 'manager'].includes(ctx.role) || ctx.profile.isSuperAdmin} today={today} />;
}
