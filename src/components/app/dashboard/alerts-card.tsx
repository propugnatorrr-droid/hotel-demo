import { ArrowRight, Info, MessageCircle, ShieldAlert, TriangleAlert } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { AlertActions } from '@/components/app/dashboard/alert-actions';
import { Card } from '@/components/ui/card';
import { Link } from '@/i18n/navigation';
import { relativeTime } from '@/lib/dates';
import { cn } from '@/lib/utils';
import type { DashboardData, Severity } from '@/server/queries/dashboard';

const STYLE: Record<Severity, { icon: typeof Info; className: string }> = {
  critical: { icon: ShieldAlert, className: 'bg-danger-soft text-danger' },
  warning: { icon: TriangleAlert, className: 'bg-accent-soft text-accent' },
  info: { icon: Info, className: 'bg-ionian-100 text-ionian-700 dark:bg-ionian-900 dark:text-ionian-200' },
};

type Props = {
  alerts: DashboardData['alerts'];
  needsHuman: number;
  canInbox: boolean;
  canResolve?: boolean;
  locale: string;
  className?: string;
};

export async function AlertsCard({ alerts, needsHuman, canInbox, canResolve, locale, className }: Props) {
  const t = await getTranslations('dashboard.alerts');
  const now = new Date();

  return (
    <Card id="alerts" className={cn('scroll-mt-24 p-5', className)}>
      <h2 className="text-sm font-medium">{t('title')}</h2>
      <p className="mt-0.5 text-xs text-subtle">{t('subtitle')}</p>

      {canInbox && needsHuman > 0 && (
        <Link
          href="/app/inbox"
          className="group mt-4 flex items-center gap-3 rounded-md border border-border bg-surface-2 px-3 py-2.5 text-sm transition-colors hover:border-border-strong"
        >
          <MessageCircle className="size-4 text-accent" />
          <span className="flex-1">{t('inbox', { count: needsHuman })}</span>
          <ArrowRight className="size-4 text-subtle transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      )}

      {alerts.length === 0 ? (
        <p className="py-10 text-center text-sm text-subtle">{t('empty')}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {alerts.slice(0, 5).map((a) => {
            const s = STYLE[a.severity];
            const Icon = s.icon;
            return (
              <li key={a.id} className="flex gap-3">
                <span className={cn('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full', s.className)}>
                  <Icon className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug font-medium">{a.title}</p>
                  {a.body && <p className="mt-0.5 text-xs leading-relaxed text-muted">{a.body}</p>}
                  <p className="mt-1 text-[11px] text-subtle">
                    {t(`severity.${a.severity}`)} · {relativeTime(a.createdAt, locale, now)}
                  </p>
                  {canResolve && <AlertActions id={a.id} type={a.type} canApply={a.hasApply} locale={locale} />}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
