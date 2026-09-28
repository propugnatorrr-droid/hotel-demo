import { getTranslations } from 'next-intl/server';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SOURCE_COLOR } from '@/config/channels';
import { diffDays } from '@/lib/dates';
import { formatCurrency, type Currency } from '@/lib/format';
import { cn, localized } from '@/lib/utils';
import type { Movement } from '@/server/queries/dashboard';

type Props = {
  arrivals: Movement[];
  departures: Movement[];
  locale: string;
  currency: Currency;
  showMoney: boolean;
  className?: string;
};

export async function Movements({ arrivals, departures, locale, currency, showMoney, className }: Props) {
  const t = await getTranslations('dashboard.movement');
  const tSource = await getTranslations('sources');

  const row = (m: Movement, kind: 'arrival' | 'departure') => {
    const name = `${m.firstName} ${m.lastName}`;
    const balance = Math.max(0, m.total - m.paid);
    let status: string;
    let tone = 'text-muted';

    if (kind === 'arrival') {
      if (m.status === 'checked_in') {
        status = t('arrived');
        tone = 'text-success';
      } else if (m.status === 'tentative') {
        status = t('tentative');
        tone = 'text-accent';
      } else {
        status = m.eta ? t('eta', { time: m.eta }) : t('expected');
      }
    } else if (m.status === 'checked_out') {
      status = t('departed');
      tone = 'text-subtle';
    } else if (showMoney && balance > 0) {
      status = t('balance', { amount: formatCurrency(balance, currency, locale) });
      tone = 'text-danger';
    } else {
      status = t('toCheckOut');
    }

    return (
      <li key={m.id} className="flex items-center gap-3 py-3 first:pt-1 last:pb-1">
        <Avatar name={name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{name}</span>
            {m.isVip && (
              <Badge tone="accent" className="px-2 py-0 text-[10px]">
                VIP
              </Badge>
            )}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted">
            {m.roomNumber ? t('room', { number: m.roomNumber }) : t('noRoom')} · {localized(m.roomTypeName, locale)} ·{' '}
            {t('nights', { count: Math.max(1, diffDays(m.checkOut, m.checkIn)) })} ·{' '}
            {t('guests', { adults: m.adults, children: m.children })}
          </p>
        </div>
        <Badge color={SOURCE_COLOR[m.source]} dot className="hidden sm:inline-flex">
          {tSource(m.source)}
        </Badge>
        <span className={cn('w-32 shrink-0 text-right text-xs', tone)}>{status}</span>
      </li>
    );
  };

  const empty = (text: string) => <p className="py-10 text-center text-sm text-subtle">{text}</p>;

  return (
    <Card className={cn('p-5', className)}>
      <Tabs defaultValue="arrivals">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium">{t('title')}</h2>
          <TabsList>
            <TabsTrigger value="arrivals">
              {t('arrivals')}
              <span className="tabular text-xs text-subtle">{arrivals.length}</span>
            </TabsTrigger>
            <TabsTrigger value="departures">
              {t('departures')}
              <span className="tabular text-xs text-subtle">{departures.length}</span>
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="arrivals">
          {arrivals.length ? (
            <ul className="divide-y divide-border">{arrivals.map((m) => row(m, 'arrival'))}</ul>
          ) : (
            empty(t('emptyArrivals'))
          )}
        </TabsContent>
        <TabsContent value="departures">
          {departures.length ? (
            <ul className="divide-y divide-border">{departures.map((m) => row(m, 'departure'))}</ul>
          ) : (
            empty(t('emptyDepartures'))
          )}
        </TabsContent>
      </Tabs>
    </Card>
  );
}
