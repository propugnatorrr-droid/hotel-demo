'use client';

import { useEffect, useState, useTransition } from 'react';
import { ArrowRight, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { formatDay } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { changeStay, previewStayChange, type StayChangePreview } from '@/server/actions/calendar';
import type { CalendarBooking } from '@/server/queries/calendar';
import { pickCopy as pickBookingCopy } from '../bookings/copy';
import { pickCalendarCopy } from './copy';

export type PendingChange = { booking: CalendarBooking; roomId: string | null; checkIn: string; checkOut: string };

type Props = {
  change: PendingChange | null;
  locale: string;
  money: (n: number) => string;
  errorText: (code: string) => string;
  onClose: (saved: boolean) => void;
};

export function StayChangeSheet({ change, locale, money, errorText, onClose }: Props) {
  const t = pickCalendarCopy(locale);
  const bt = pickBookingCopy(locale);
  const [pricing, setPricing] = useState<'keep' | 'requote' | null>(null);
  const [preview, setPreview] = useState<StayChangePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, startSave] = useTransition();

  useEffect(() => {
    setPricing(null);
    setPreview(null);
    setError(null);
  }, [change]);

  useEffect(() => {
    if (!change) return;
    let alive = true;
    setLoading(true);
    previewStayChange({
      bookingId: change.booking.id,
      roomId: change.roomId,
      checkIn: change.checkIn,
      checkOut: change.checkOut,
      pricing: pricing ?? 'auto',
    }).then((res) => {
      if (!alive) return;
      setLoading(false);
      if (res.ok) {
        setPreview(res.data);
        setError(null);
      } else {
        setPreview(null);
        setError(res.error);
      }
    });
    return () => {
      alive = false;
    };
  }, [change, pricing]);

  const b = change?.booking;
  const range = (a: string, z: string) =>
    `${formatDay(a, locale, { day: 'numeric', month: 'short' })} – ${formatDay(z, locale, { day: 'numeric', month: 'short' })}`;

  function save() {
    if (!change || !preview) return;
    startSave(async () => {
      const res = await changeStay({
        bookingId: change.booking.id,
        roomId: change.roomId,
        checkIn: change.checkIn,
        checkOut: change.checkOut,
        pricing: preview.pricing,
      });
      if (res.ok) onClose(true);
      else setError(res.error);
    });
  }

  return (
    <Sheet open={Boolean(change)} onOpenChange={(o) => !o && !saving && onClose(false)}>
      <SheetContent closeLabel={bt.close} className="overflow-y-auto">
        {b && change && (
          <>
            <SheetHeader>
              <SheetTitle>{t.change.title}</SheetTitle>
              <SheetDescription>
                {b.firstName} {b.lastName} · {b.code}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5 p-6">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl border border-border p-4">
                <div>
                  <p className="text-xs text-muted">{t.change.before}</p>
                  <p className="mt-1 font-medium">{range(b.checkIn, b.checkOut)}</p>
                  <p className="text-xs text-muted">
                    {b.roomNumber ? `${bt.room} ${b.roomNumber}` : bt.unassigned}
                  </p>
                </div>
                <ArrowRight className="size-4 text-subtle" />
                <div>
                  <p className="text-xs text-muted">{t.change.after}</p>
                  <p className="mt-1 font-medium">{range(change.checkIn, change.checkOut)}</p>
                  <p className="text-xs text-muted">
                    {preview?.roomNumber ? `${bt.room} ${preview.roomNumber}` : change.roomId ? '…' : bt.unassigned}
                    {preview?.upgrade && <span className="ml-1 text-gold-600">· {t.change.upgrade}</span>}
                  </p>
                </div>
              </div>

              {loading && !preview && <div className="h-24 animate-pulse rounded-xl bg-surface-2" aria-label={t.change.checking} />}

              {preview && (
                <div className="rounded-xl border border-border p-4">
                  <p className="text-xs text-muted">{t.change.price}</p>
                  <div className="mt-2 flex items-baseline gap-3">
                    <span className="font-serif text-4xl tabular-nums">{money(preview.total)}</span>
                    {preview.total !== preview.previousTotal && (
                      <span className="text-sm text-subtle line-through tabular-nums">{money(preview.previousTotal)}</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {bt.nights(preview.previousNights)} → {bt.nights(preview.nights)}
                  </p>

                  {preview.canKeep && preview.quotedTotal !== preview.previousTotal && (
                    <div className="mt-4 grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1 text-xs">
                      {(['keep', 'requote'] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setPricing(m)}
                          className={cn(
                            'rounded-full py-2 transition-colors',
                            preview.pricing === m ? 'bg-surface font-medium shadow-soft' : 'text-muted',
                          )}
                        >
                          {m === 'keep' ? `${t.change.keep} · ${money(preview.previousTotal)}` : `${t.change.requote} · ${money(preview.quotedTotal)}`}
                        </button>
                      ))}
                    </div>
                  )}
                  {!preview.canKeep && <p className="mt-3 text-xs text-muted">{t.change.requoteNote}</p>}
                </div>
              )}

              {preview && (preview.ota || preview.warnings.length > 0) && (
                <ul className="space-y-2 text-xs">
                  {preview.ota && (
                    <li className="flex gap-2 rounded-lg bg-gold-400/10 p-3 text-gold-700 dark:text-gold-400">
                      <TriangleAlert className="size-4 shrink-0" /> {t.change.ota}
                    </li>
                  )}
                  {preview.warnings.map((w) => (
                    <li key={w} className="flex gap-2 rounded-lg bg-gold-400/10 p-3 text-gold-700 dark:text-gold-400">
                      <TriangleAlert className="size-4 shrink-0" /> {t.change.warnings[w]}
                    </li>
                  ))}
                </ul>
              )}

              {error && <p className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{errorText(error)}</p>}

              <div className="flex gap-2">
                <Button variant="secondary" className="flex-1" onClick={() => onClose(false)} disabled={saving}>
                  {t.change.cancel}
                </Button>
                <Button className="flex-1" onClick={save} disabled={!preview || loading || saving}>
                  {t.change.confirm}
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
