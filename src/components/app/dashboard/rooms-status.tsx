import { getTranslations } from 'next-intl/server';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { DashboardData, RoomStatus } from '@/server/queries/dashboard';

const ORDER: RoomStatus[] = ['inspected', 'clean', 'dirty', 'out_of_order'];
const COLOR: Record<RoomStatus, string> = {
  inspected: 'bg-ionian-400',
  clean: 'bg-olive-400',
  dirty: 'bg-terracotta-400',
  out_of_order: 'bg-limestone-500',
};

type Props = {
  rooms: DashboardData['rooms'];
  housekeeping: DashboardData['housekeeping'];
  className?: string;
};

export async function RoomsStatus({ rooms, housekeeping, className }: Props) {
  const t = await getTranslations('dashboard.rooms');
  const tStatus = await getTranslations('roomStatus');
  const total = Math.max(1, rooms.total);

  return (
    <Card className={cn('p-5', className)}>
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium">{t('title')}</h2>
        <span className="tabular text-xs text-subtle">{rooms.total}</span>
      </div>

      <div className="mt-4 flex h-2.5 gap-0.5 overflow-hidden rounded-full">
        {ORDER.filter((s) => rooms.byStatus[s] > 0).map((s) => (
          <div key={s} className={COLOR[s]} style={{ width: `${(rooms.byStatus[s] / total) * 100}%` }} />
        ))}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
        {ORDER.map((s) => (
          <div key={s} className="flex items-center justify-between gap-2 text-xs">
            <dt className="flex items-center gap-1.5 text-muted">
              <span className={cn('size-2 rounded-full', COLOR[s])} />
              {tStatus(s)}
            </dt>
            <dd className="tabular font-medium">{rooms.byStatus[s]}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 border-t border-border pt-3 text-xs text-muted">
        {t('tasks', { open: housekeeping.open, inProgress: housekeeping.inProgress, done: housekeeping.done })}
      </p>
    </Card>
  );
}
