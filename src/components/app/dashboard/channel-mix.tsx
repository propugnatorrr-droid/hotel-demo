import { getTranslations } from 'next-intl/server';
import { Card } from '@/components/ui/card';
import { SOURCE_COLOR } from '@/config/channels';
import { formatCurrency, formatPercent, type Currency } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ChannelRow } from '@/server/queries/dashboard';

type Props = { rows: ChannelRow[]; locale: string; currency: Currency; className?: string };

export async function ChannelMix({ rows, locale, currency, className }: Props) {
  const t = await getTranslations('dashboard.channels');
  const tSource = await getTranslations('sources');
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const commission = rows.reduce((s, r) => s + r.commission, 0);
  const b = (chunks: React.ReactNode) => <span className="font-medium text-foreground">{chunks}</span>;

  return (
    <Card className={cn('p-5', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">{t('title')}</h2>
        <span className="text-xs text-subtle">{t('subtitle')}</span>
      </div>

      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-subtle">{t('empty')}</p>
      ) : (
        <ul className="mt-5 grid gap-x-10 gap-y-4 lg:grid-cols-2">
          {rows.map((r) => {
            const share = total > 0 ? (r.amount / total) * 100 : 0;
            return (
              <li key={r.source}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ background: SOURCE_COLOR[r.source] }} />
                    {tSource(r.source)}
                    <span className="tabular text-xs text-subtle">{formatPercent(share, locale)}</span>
                  </span>
                  <span className="tabular text-xs text-muted">
                    {t('bookings', { count: r.n })} ·{' '}
                    <span className="text-foreground">{formatCurrency(r.amount, currency, locale)}</span>
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full" style={{ width: `${share}%`, background: SOURCE_COLOR[r.source] }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {commission > 0 && (
        <p className="mt-5 border-t border-border pt-3 text-xs text-muted">
          {t.rich('commission', { amount: formatCurrency(commission, currency, locale), b })}
        </p>
      )}
    </Card>
  );
}
