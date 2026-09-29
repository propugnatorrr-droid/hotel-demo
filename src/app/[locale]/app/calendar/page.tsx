import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { z } from 'zod';
import { TapeChart } from '@/components/app/calendar/tape-chart';
import { requireOrg } from '@/lib/auth/session';
import { addDays, diffDays, todayIn } from '@/lib/dates';
import { getCalendar } from '@/server/queries/calendar';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ from?: string; days?: string }>;
};

const WINDOWS = [14, 30, 60];

export default async function CalendarPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await requireOrg();
  const front = ['owner', 'manager', 'receptionist'].includes(ctx.role) || ctx.profile.isSuperAdmin;
  if (!ctx.modules.has('calendar') || !front) notFound();

  const sp = await searchParams;
  const today = todayIn(ctx.org.timezone);
  const days = WINDOWS.includes(Number(sp.days)) ? Number(sp.days) : 30;
  const parsed = z.iso.date().safeParse(sp.from);
  let from = parsed.success ? parsed.data : addDays(today, -2);
  if (Math.abs(diffDays(from, today)) > 730) from = addDays(today, -2);

  const data = await getCalendar(ctx, from, days);

  return (
    <TapeChart
      data={data}
      from={from}
      days={days}
      today={today}
      locale={locale}
      currency={ctx.org.currency}
      manager={['owner', 'manager'].includes(ctx.role) || ctx.profile.isSuperAdmin}
    />
  );
}
