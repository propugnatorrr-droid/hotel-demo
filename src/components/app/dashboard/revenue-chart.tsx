'use client';

import { MotionConfig, motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

export type RevenuePoint = {
  day: string;
  short: string;
  long: string;
  rooms: number;
  fb: number;
  spa: number;
  total: number;
  isToday: boolean;
};

type Props = {
  points: RevenuePoint[];
  locale: string;
  currency: 'ALL' | 'EUR' | 'USD';
  labels: { rooms: string; fb: string; spa: string; today: string };
};

const SEGMENTS = [
  { key: 'rooms', className: 'bg-ionian-700 dark:bg-ionian-300' },
  { key: 'fb', className: 'bg-terracotta-400' },
  { key: 'spa', className: 'bg-olive-400' },
] as const;

export function RevenueChart({ points, locale, currency, labels }: Props) {
  const [active, setActive] = useState<number | null>(null);
  const idx = active ?? Math.max(0, points.length - 2);
  const p = points[idx];
  const max = Math.max(1, ...points.map((x) => x.total));

  const fmt = useMemo(
    () =>
      new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'sq-AL', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
      }),
    [locale, currency],
  );

  if (!p) return null;

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs text-muted" suppressHydrationWarning>
            {p.long}
            {p.isToday ? ` · ${labels.today}` : ''}
          </p>
          <p className="font-display tabular mt-1 text-4xl" suppressHydrationWarning>
            {fmt.format(p.total)}
          </p>
        </div>
        <dl className="flex gap-5 text-xs">
          {SEGMENTS.map((s) => (
            <div key={s.key}>
              <dt className="flex items-center gap-1.5 text-muted">
                <span className={cn('size-2 rounded-full', s.className)} />
                {labels[s.key]}
              </dt>
              <dd className="tabular mt-0.5 text-foreground" suppressHydrationWarning>
                {fmt.format(p[s.key])}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-6 flex h-48 items-end gap-1.5" onMouseLeave={() => setActive(null)}>
        {points.map((pt, i) => (
          <button
            key={pt.day}
            type="button"
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onClick={() => setActive(i)}
            aria-label={`${pt.long}: ${fmt.format(pt.total)}`}
            suppressHydrationWarning
            className="flex h-full flex-1 cursor-pointer flex-col justify-end rounded-sm"
          >
            <motion.div
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: i * 0.03, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              style={{ height: `${(pt.total / max) * 100}%`, minHeight: 2, originY: 1 }}
              className={cn(
                'flex w-full flex-col-reverse gap-px overflow-hidden rounded-[5px] transition-opacity duration-200',
                active !== null && active !== i && 'opacity-40',
                pt.isToday && active !== i && 'opacity-55',
              )}
            >
              {SEGMENTS.map((s) => (
                <div
                  key={s.key}
                  className={s.className}
                  style={{ height: `${pt.total > 0 ? (pt[s.key] / pt.total) * 100 : 0}%` }}
                />
              ))}
            </motion.div>
          </button>
        ))}
      </div>

      <div className="mt-2 flex gap-1.5">
        {points.map((pt, i) => (
          <span
            key={pt.day}
            className={cn(
              'tabular flex-1 text-center text-[10px] text-subtle transition-colors',
              i === idx && 'font-medium text-foreground',
            )}
          >
            {pt.short}
          </span>
        ))}
      </div>
    </MotionConfig>
  );
}
