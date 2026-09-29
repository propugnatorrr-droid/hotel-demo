import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { ReportsView } from '@/components/app/reports/reports-view';
import { requireOrg } from '@/lib/auth/session';
import { todayIn } from '@/lib/dates';
import { resolveRange } from '@/lib/report-range';
import { getReport } from '@/server/queries/reports';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ preset?: string; from?: string; to?: string; user?: string }> };

export default async function ReportsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireOrg();
  if (!ctx.modules.has('reports') || (!['owner', 'manager', 'accountant'].includes(ctx.role) && !ctx.profile.isSuperAdmin)) notFound();

  const sp = await searchParams;
  const { preset, from, to } = resolveRange(todayIn(ctx.org.timezone), sp);
  const userId = /^[0-9a-f-]{36}$/i.test(sp.user ?? '') ? sp.user! : null;
  const data = await getReport(ctx, from, to, userId);
  return <ReportsView data={data} locale={locale} currency={ctx.org.currency} preset={preset} userId={userId} mounted={new Date().toISOString()} />;
}
