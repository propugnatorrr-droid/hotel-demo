import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { CalendarBoard } from '@/components/app/calendar/calendar-board';
import { requireOrg } from '@/lib/auth/session';
import { addDays, todayIn } from '@/lib/dates';
import { CALENDAR_SPANS, getCalendar } from '@/server/queries/calendar';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ start?: string; days?: string }> };

export default async function CalendarPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireOrg();
  if (!ctx.modules.has('calendar') || (!['owner', 'manager', 'receptionist'].includes(ctx.role) && !ctx.profile.isSuperAdmin)) notFound();

  const sp = await searchParams;
  const today = todayIn(ctx.org.timezone);
  const days = (CALENDAR_SPANS as readonly number[]).includes(Number(sp.days)) ? Number(sp.days) : 14;
  const start = /^\d{4}-\d{2}-\d{2}$/.test(sp.start ?? '') ? (sp.start as string) : addDays(today, -2);

  const data = await getCalendar(ctx, start, days, locale);
  return (
    <CalendarBoard
      data={data}
      locale={locale}
      currency={ctx.org.currency}
      orgId={ctx.org.id}
      manager={['owner', 'manager'].includes(ctx.role) || ctx.profile.isSuperAdmin}
      spans={CALENDAR_SPANS}
    />
  );
}
