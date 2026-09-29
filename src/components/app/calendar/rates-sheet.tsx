'use client';

import { useEffect, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { formatDay } from '@/lib/dates';
import { formatCurrency, type Currency } from '@/lib/format';
import { cn, localized } from '@/lib/utils';
import { updateRates } from '@/server/actions/calendar';
import type { CalendarData } from '@/server/queries/calendar';
import { pickCalendarCopy } from './copy';

export type RateTarget = { roomTypeId: string; date: string };
type Cell = CalendarData['inventory'][number]['days'][number];

type Props = {
  target: RateTarget | null;
  types: CalendarData['types'];
  inventory: Map<string, Cell[]>;
  today: string;
  locale: string;
  currency: Currency;
  errorText: (code: string) => string;
  onClose: (days: number | null) => void;
};

// Monday first; values are JS getUTCDay()
const WEEK = [1, 2, 3, 4, 5, 6, 0];
const field = 'h-10 w-full min-w-0 rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-border-strong';
const lbl = 'mb-1.5 block text-xs text-muted';

export function RatesSheet({ target, types, inventory, today, locale, currency, errorText, onClose }: Props) {
  const t = pickCalendarCopy(locale).ratesForm;
  const [typeId, setTypeId] = useState('');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [weekdays, setWeekdays] = useState<number[]>(WEEK);
  const [price, setPrice] = useState('');
  const [minStay, setMinStay] = useState('');
  const [sale, setSale] = useState<'unchanged' | 'open' | 'closed'>('unchanged');
  const [error, setError] = useState<string | null>(null);
  const [saving, start] = useTransition();

  useEffect(() => {
    if (!target) return;
    const d = target.date < today ? today : target.date;
    setTypeId(target.roomTypeId);
    setFrom(d);
    setTo(d);
    setWeekdays(WEEK);
    setPrice('');
    setMinStay('');
    setSale('unchanged');
    setError(null);
  }, [target, today]);

  const current = inventory.get(typeId)?.find((c) => c.date === from);
  const dayName = (n: number) => formatDay(`2026-01-${String(4 + n).padStart(2, '0')}`, locale, { weekday: 'short' }); // 2026-01-04 is a Sunday

  function save() {
    setError(null);
    start(async () => {
      const res = await updateRates({
        roomTypeId: typeId,
        from,
        to,
        weekdays,
        price: price === '' ? undefined : Number(price),
        minStay: minStay === '' ? undefined : Number(minStay),
        closed: sale === 'unchanged' ? undefined : sale === 'closed',
      });
      if (res.ok) onClose(res.data.days);
      else setError(res.error);
    });
  }

  return (
    <Sheet open={Boolean(target)} onOpenChange={(o) => !o && !saving && onClose(null)}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t.title}</SheetTitle>
          <SheetDescription>{t.subtitle}</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 p-6">
          <label className="block">
            <span className={lbl}>{t.type}</span>
            <select className={field} value={typeId} onChange={(e) => setTypeId(e.target.value)}>
              {types.map((ty) => (
                <option key={ty.id} value={ty.id}>
                  {localized(ty.name, locale)}
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className={lbl}>{t.from}</span>
              <input
                type="date"
                className={field}
                min={today}
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  if (e.target.value > to) setTo(e.target.value);
                }}
              />
            </label>
            <label>
              <span className={lbl}>{t.to}</span>
              <input type="date" className={field} min={from} value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>

          <div>
            <span className={lbl}>{t.weekdays}</span>
            <div className="grid grid-cols-7 gap-1">
              {WEEK.map((d) => {
                const on = weekdays.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setWeekdays((w) => (on ? w.filter((x) => x !== d) : [...w, d]))}
                    className={cn(
                      'h-9 rounded-md border text-xs capitalize transition-colors',
                      on ? 'border-ionian-500 bg-ionian-100 text-ionian-800 dark:bg-ionian-900 dark:text-ionian-100' : 'border-border text-muted',
                    )}
                  >
                    {dayName(d)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label>
              <span className={lbl}>{t.price}</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                className={field}
                value={price}
                placeholder={current ? String(current.price) : ''}
                onChange={(e) => setPrice(e.target.value)}
              />
            </label>
            <label>
              <span className={lbl}>{t.minStay}</span>
              <input
                type="number"
                min={1}
                max={30}
                className={field}
                value={minStay}
                placeholder={current ? String(current.minStay) : ''}
                onChange={(e) => setMinStay(e.target.value)}
              />
            </label>
          </div>

          <div>
            <span className={lbl}>{t.sale}</span>
            <div className="grid grid-cols-3 gap-1 rounded-full bg-surface-2 p-1 text-xs">
              {(['unchanged', 'open', 'closed'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSale(s)}
                  className={cn('rounded-full py-2', sale === s ? 'bg-surface font-medium shadow-soft' : 'text-muted')}
                >
                  {t[s]}
                </button>
              ))}
            </div>
          </div>

          {current && (
            <p className="text-xs text-muted">
              {t.current}: {formatCurrency(current.price, currency, locale, 2)} · min {current.minStay} · {current.closed ? t.closed : t.open}
            </p>
          )}
          <p className="text-xs text-subtle">{t.blank}</p>

          {error && <p className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{errorText(error)}</p>}

          <Button className="w-full" onClick={save} disabled={saving || !typeId || weekdays.length === 0}>
            {t.save}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
