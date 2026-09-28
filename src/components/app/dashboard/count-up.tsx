'use client';

import { useLayoutEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  value: number;
  locale: string;
  kind?: 'number' | 'currency' | 'percent';
  currency?: 'ALL' | 'EUR' | 'USD';
  digits?: number;
  duration?: number;
  className?: string;
};

export function CountUp({ value, locale, kind = 'number', currency = 'EUR', digits = 0, duration = 900, className }: Props) {
  const [display, setDisplay] = useState(value);

  const fmt = useMemo(() => {
    const tag = locale === 'en' ? 'en-GB' : 'sq-AL';
    if (kind === 'currency')
      return new Intl.NumberFormat(tag, { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits });
    if (kind === 'percent') return new Intl.NumberFormat(tag, { style: 'percent', maximumFractionDigits: digits });
    return new Intl.NumberFormat(tag, { maximumFractionDigits: digits });
  }, [locale, kind, currency, digits]);

  useLayoutEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setDisplay(value * (1 - Math.pow(1 - p, 4)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    setDisplay(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return (
    <span className={cn('tabular', className)} suppressHydrationWarning>
      {fmt.format(kind === 'percent' ? display / 100 : display)}
    </span>
  );
}
