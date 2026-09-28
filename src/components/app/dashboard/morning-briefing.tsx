import { ArrowRight, Sparkles } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { formatDay } from '@/lib/dates';
import { formatCurrency, formatPercent, type Currency } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { DashboardData } from '@/server/queries/dashboard';

type Props = {
  data: DashboardData;
  locale: string;
  currency: Currency;
  showMoney: boolean;
  canInbox: boolean;
  canCalendar: boolean;
  className?: string;
};

export async function MorningBriefing({ data, locale, currency, showMoney, canInbox, canCalendar, className }: Props) {
  const t = await getTranslations('dashboard.briefing');
  const b = (chunks: React.ReactNode) => <span className="text-ionian-500 dark:text-gold-400">{chunks}</span>;

  const parts: React.ReactNode[] = [];
  const y = data.yesterday;

  if (showMoney) {
    const amount = formatCurrency(y.total, currency, locale);
    if (y.changePct === null) {
      parts.push(t.rich('revenueNoCompare', { amount, b }));
    } else {
      const dir = y.changePct > 0 ? 'up' : y.changePct < 0 ? 'down' : 'same';
      parts.push(t.rich('revenue', { amount, pct: formatPercent(Math.abs(y.changePct), locale), dir, b }));
    }
  }

  parts.push(
    t.rich('occupancy', {
      occ: formatPercent(data.tonight.occupancy, locale),
      occupied: data.tonight.occupied,
      total: data.rooms.sellable,
      b,
    }),
  );

  const vip = data.arrivals.filter((a) => a.isVip).length;
  parts.push(t.rich('movements', { arrivals: data.arrivals.length, vip, departures: data.departures.length, b }));

  const peak = data.forecast.slice(1).reduce<(typeof data.forecast)[number] | null>(
    (best, p) => (!best || p.occupancy > best.occupancy ? p : best),
    null,
  );
  if (peak && peak.occupancy >= 60) {
    parts.push(
      t.rich('peak', {
        day: formatDay(peak.day, locale, { weekday: 'long', day: 'numeric', month: 'long' }),
        occ: formatPercent(peak.occupancy, locale),
        b,
      }),
    );
  }

  const attention = data.alerts.filter((a) => a.severity !== 'info').length + data.needsHuman;
  parts.push(attention > 0 ? t.rich('attention', { count: attention, b }) : t('allGood'));

  return (
    <section
      className={cn('ai-glow animate-fade-up relative overflow-hidden rounded-xl p-6 shadow-soft [animation-delay:120ms] md:p-10', className)}
    >
      <div className="bg-qilim pointer-events-none absolute inset-0 opacity-60 [mask-image:linear-gradient(120deg,transparent_45%,black)]" />
      <div className="relative">
        <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-accent uppercase">
          <Sparkles className="size-3.5" />
          {t('eyebrow')}
        </p>

        <p className="mt-5 max-w-4xl font-serif text-2xl leading-[1.3] tracking-[-0.01em] text-foreground md:text-[2.1rem]">
          {parts.map((p, i) => (
            <span key={i}>
              {p}
              {i < parts.length - 1 ? ' ' : ''}
            </span>
          ))}
        </p>

        <div className="mt-8 flex flex-wrap gap-2">
          {attention > 0 && data.alerts.length > 0 && (
            <Button asChild variant="secondary" size="sm">
              <a href="#alerts">
                {t('actionAlerts')}
                <ArrowRight />
              </a>
            </Button>
          )}
          {canInbox && data.needsHuman > 0 && (
            <Button asChild variant="secondary" size="sm">
              <Link href="/app/inbox">
                {t('actionInbox')}
                <ArrowRight />
              </Link>
            </Button>
          )}
          {canCalendar && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/app/calendar">
                {t('actionCalendar')}
                <ArrowRight />
              </Link>
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
