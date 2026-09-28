import { getTranslations } from 'next-intl/server';
import { Card } from '@/components/ui/card';
import { formatDay } from '@/lib/dates';
import { formatPercent } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ForecastPoint } from '@/server/queries/dashboard';

type Props = { forecast: ForecastPoint[]; locale: string; className?: string };

export async function Forecast({ forecast, locale, className }: Props) {
  const t = await getTranslations('dashboard.forecast');

  return (
    <Card className={cn('p-5', className)}>
      <h2 className="text-sm font-medium">{t('title')}</h2>
      <div className="mt-4 flex h-28 items-end gap-2">
        {forecast.map((p, i) => (
          <div key={p.day} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
            <span className="tabular text-[10px] text-muted">{formatPercent(p.occupancy, locale)}</span>
            <div
              className={cn(
                'w-full rounded-[5px] transition-all',
                p.occupancy >= 85 ? 'bg-gold-400' : 'bg-ionian-200 dark:bg-ionian-700',
                i === 0 && 'ring-2 ring-ring ring-offset-2 ring-offset-surface',
              )}
              style={{ height: `${Math.max(4, p.occupancy)}%` }}
            />
            <span className={cn('text-[10px] text-subtle', i === 0 && 'font-medium text-foreground')}>
              {i === 0 ? t('today') : formatDay(p.day, locale, { weekday: 'short' })}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
