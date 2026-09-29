import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { SpaBoard } from '@/components/app/spa/spa-board';
import { requireOrg } from '@/lib/auth/session';
import { todayIn } from '@/lib/dates';
import { getSpa } from '@/server/queries/spa';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ date?: string }> };

export default async function SpaPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireOrg();
  if (!ctx.modules.has('spa') || (!['owner', 'manager', 'receptionist', 'spa'].includes(ctx.role) && !ctx.profile.isSuperAdmin)) notFound();
  const today = todayIn(ctx.org.timezone);
  const sp = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? '') ? (sp.date as string) : today;
  const data = await getSpa(ctx, date, locale);
  return <SpaBoard data={data} locale={locale} currency={ctx.org.currency} manager={['owner', 'manager'].includes(ctx.role) || ctx.profile.isSuperAdmin} today={today} />;
}
