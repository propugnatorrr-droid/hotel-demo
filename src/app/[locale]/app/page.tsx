import { ArrowLeftRight, BedDouble, Euro, SprayCan, Tag, Users } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { AlertsCard } from '@/components/app/dashboard/alerts-card';
import { ChannelMix } from '@/components/app/dashboard/channel-mix';
import { CountUp } from '@/components/app/dashboard/count-up';
import { Forecast } from '@/components/app/dashboard/forecast';
import { KpiCard } from '@/components/app/dashboard/kpi-card';
import { MorningBriefing } from '@/components/app/dashboard/morning-briefing';
import { Movements } from '@/components/app/dashboard/movements';
import { RevenueChart, type RevenuePoint } from '@/components/app/dashboard/revenue-chart';
import { RoomsStatus } from '@/components/app/dashboard/rooms-status';
import { Card } from '@/components/ui/card';
import { canAccess, NAV } from '@/config/navigation';
import { requireOrg } from '@/lib/auth/session';
import { capitalize, formatDay, hourIn } from '@/lib/dates';
import { formatCurrency, formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import { getDashboard } from '@/server/queries/dashboard';

type Props = { params: Promise<{ locale: string }> };

const MONEY_ROLES: readonly string[] = ['owner', 'manager', 'accountant'];

export default async function TodayPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await requireOrg();
  const [data, t, tGreeting] = await Promise.all([
    getDashboard(ctx),
    getTranslations('dashboard'),
    getTranslations('shell.greeting'),
  ]);

  const currency = ctx.org.currency;
  const showMoney = MONEY_ROLES.includes(ctx.role) || ctx.profile.isSuperAdmin;
  const simple = ctx.profile.simpleMode;
  const can = (key: string) => {
    const item = NAV.find((i) => i.key === key);
    return item ? canAccess(item, ctx.role, ctx.modules) : false;
  };

  const hour = hourIn(ctx.org.timezone);
  const greeting = hour >= 5 && hour < 12 ? 'morning' : hour >= 12 && hour < 18 ? 'afternoon' : 'evening';
  const firstName = ctx.profile.fullName?.split(' ')[0];
  const dateLabel = capitalize(formatDay(data.today, locale, { weekday: 'long', day: 'numeric', month: 'long' }));

  const y = data.yesterday;
  const dir = y.changePct === null ? null : y.changePct > 0 ? 'up' : y.changePct < 0 ? 'down' : 'same';

  const points: RevenuePoint[] = data.series.map((p) => ({
    ...p,
    short: formatDay(p.day, locale, { day: 'numeric' }),
    long: capitalize(formatDay(p.day, locale, { weekday: 'long', day: 'numeric', month: 'short' })),
    isToday: p.day === data.today,
  }));

  return (
    <div className="mx-auto max-w-6xl">
      <header>
        <p className="animate-fade-up text-sm text-muted">
          {dateLabel} · {ctx.org.name}
        </p>
        <h1 className="font-display animate-fade-up mt-2 text-5xl [animation-delay:60ms] md:text-7xl">
          {tGreeting(greeting)}
          {firstName ? `, ${firstName}` : ''}.
        </h1>
      </header>

      <MorningBriefing
        data={data}
        locale={locale}
        currency={currency}
        showMoney={showMoney}
        canInbox={can('inbox')}
        canCalendar={can('calendar')}
        className="mt-8"
      />

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {showMoney ? (
          <KpiCard
            label={t('kpi.revenueYesterday')}
            icon={Euro}
            value={<CountUp value={y.total} locale={locale} kind="currency" currency={currency} />}
            sub={
              dir === null
                ? t('kpi.noCompare')
                : t('kpi.vsLastWeek', { dir, pct: formatPercent(Math.abs(y.changePct ?? 0), locale) })
            }
            tone={dir === 'up' ? 'up' : dir === 'down' ? 'down' : 'neutral'}
          />
        ) : (
          <KpiCard
            label={t('kpi.inHouse')}
            icon={Users}
            value={<CountUp value={data.inHouse} locale={locale} />}
            sub={t('kpi.arrivalsToday', { count: data.arrivals.length })}
          />
        )}

        <KpiCard
          label={t('kpi.occupancyTonight')}
          icon={BedDouble}
          value={<CountUp value={data.tonight.occupancy} locale={locale} kind="percent" />}
          sub={t('kpi.roomsOf', { occupied: data.tonight.occupied, total: data.rooms.sellable })}
          className="[animation-delay:60ms]"
        />

        {showMoney ? (
          <KpiCard
            label={t('kpi.adr')}
            icon={Tag}
            value={<CountUp value={y.adr} locale={locale} kind="currency" currency={currency} />}
            sub={t('kpi.revpar', { value: formatCurrency(y.revpar, currency, locale) })}
            className="[animation-delay:120ms]"
          />
        ) : (
          <KpiCard
            label={t('kpi.housekeeping')}
            icon={SprayCan}
            value={<CountUp value={data.housekeeping.open + data.housekeeping.inProgress} locale={locale} />}
            sub={t('kpi.housekeepingSub', { done: data.housekeeping.done, inProgress: data.housekeeping.inProgress })}
            className="[animation-delay:120ms]"
          />
        )}

        <KpiCard
          label={t('kpi.movements')}
          icon={ArrowLeftRight}
          value={
            <>
              <CountUp value={data.arrivals.length} locale={locale} />
              <span className="mx-2 text-subtle">·</span>
              <CountUp value={data.departures.length} locale={locale} />
            </>
          }
          sub={t('kpi.inHouseNow', { count: data.inHouse })}
          className="[animation-delay:180ms]"
        />
      </div>

      {!simple && (
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {showMoney && (
            <Card className="p-5 lg:col-span-2">
              <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-medium">{t('revenue.title')}</h2>
                <span className="text-xs text-subtle">{t('revenue.subtitle')}</span>
              </div>
              <RevenueChart
                points={points}
                locale={locale}
                currency={currency}
                labels={{
                  rooms: t('revenue.rooms'),
                  fb: t('revenue.fb'),
                  spa: t('revenue.spa'),
                  today: t('revenue.today'),
                }}
              />
            </Card>
          )}
          <AlertsCard
            alerts={data.alerts}
            needsHuman={data.needsHuman}
            canInbox={can('inbox')}
            locale={locale}
            className={showMoney ? undefined : 'lg:col-span-3'}
          />
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Movements
          arrivals={data.arrivals}
          departures={data.departures}
          locale={locale}
          currency={currency}
          showMoney={showMoney}
          className={cn(simple ? 'lg:col-span-3' : 'lg:col-span-2')}
        />
        {!simple && (
          <div className="grid content-start gap-4">
            <RoomsStatus rooms={data.rooms} housekeeping={data.housekeeping} />
            <Forecast forecast={data.forecast} locale={locale} />
          </div>
        )}
      </div>

      {!simple && showMoney && (
        <ChannelMix rows={data.channels} locale={locale} currency={currency} className="mt-4" />
      )}
    </div>
  );
}
