'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight, Crown, Radio, SlidersHorizontal } from 'lucide-react';
import { PageHero } from '@/components/app/page-hero';
import { useAction } from '@/components/app/use-action';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Label } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { SOURCE_COLOR, type BookingSource } from '@/config/channels';
import { addDays, diffDays, formatDay } from '@/lib/dates';
import { isSupabaseConfigured } from '@/lib/env';
import { formatCurrency, type Currency } from '@/lib/format';
import { Link as IntlLink } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { createBooking } from '@/server/actions/bookings';
import { moveBooking, setRates } from '@/server/actions/calendar';
import type { CalendarData } from '@/server/queries/calendar';
import { pickCalendarCopy } from './copy';

type Booking = CalendarData['bookings'][number];
type Override = { roomId: string | null; checkIn: string; checkOut: string };

const RAIL = 128;
const ROW = 44;
const selectCls = 'h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm';

const dow = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay();

export function CalendarBoard({
  data,
  locale,
  currency,
  orgId,
  manager,
  spans,
}: {
  data: CalendarData;
  locale: string;
  currency: Currency;
  orgId: string;
  manager: boolean;
  spans: readonly number[];
}) {
  const t = pickCalendarCopy(locale);
  const router = useRouter();
  const pathname = usePathname();
  const { start, days, today } = data;
  const cw = days <= 14 ? 66 : 40;
  const width = days * cw;
  const dates = useMemo(() => Array.from({ length: days }, (_, i) => addDays(start, i)), [start, days]);

  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [dragging, setDragging] = useState<{ id: string; grab: number } | null>(null);
  const [hover, setHover] = useState<{ roomId: string | null; day: number } | null>(null);
  const [resize, setResize] = useState<{ id: string; nights: number } | null>(null);
  const [detail, setDetail] = useState<Booking | null>(null);
  const [quick, setQuick] = useState<{ roomId: string; date: string } | null>(null);
  const [rateEdit, setRateEdit] = useState<{ typeId: string; date: string } | null>(null);
  const [live, setLive] = useState(false);
  const flash = (ok: boolean, text: string) => {
    setToast({ ok, text });
    window.setTimeout(() => setToast(null), 3200);
  };

  useEffect(() => setOverrides({}), [data]);

  // Realtime: any booking change anywhere refreshes the board.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = createClient();
    let timer: number | undefined;
    const channel = supabase
      .channel(`calendar-${orgId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `org_id=eq.${orgId}` }, () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => router.refresh(), 350);
      })
      .subscribe((status) => setLive(status === 'SUBSCRIBED'));
    return () => {
      window.clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [orgId, router]);

  const bookings = useMemo(
    () =>
      data.bookings.map((b) => {
        const o = overrides[b.id];
        return o ? { ...b, ...o } : b;
      }),
    [data.bookings, overrides],
  );

  const byRoom = useMemo(() => {
    const m = new Map<string, Booking[]>();
    for (const b of bookings) {
      const key = b.roomId ?? `type:${b.roomTypeId}`;
      const list = m.get(key) ?? [];
      list.push(b);
      m.set(key, list);
    }
    return m;
  }, [bookings]);

  const rateByKey = useMemo(() => new Map(data.rates.map((r) => [`${r.roomTypeId}|${r.date}`, r])), [data.rates]);

  function href(next: { start?: string; days?: number }) {
    const p = new URLSearchParams();
    p.set('start', next.start ?? start);
    p.set('days', String(next.days ?? days));
    return `${pathname}?${p.toString()}`;
  }

  async function commitMove(id: string, patch: { roomId?: string | null; checkIn?: string; checkOut?: string }) {
    const b = bookings.find((x) => x.id === id);
    if (!b) return;
    const next: Override = {
      roomId: patch.roomId !== undefined ? patch.roomId : b.roomId,
      checkIn: patch.checkIn ?? b.checkIn,
      checkOut: patch.checkOut ?? b.checkOut,
    };
    setOverrides((o) => ({ ...o, [id]: next }));
    const res = await moveBooking({ bookingId: id, ...patch });
    if (!res.ok) {
      setOverrides((o) => {
        const { [id]: _drop, ...rest } = o;
        return rest;
      });
      flash(false, t.errors[res.error] ?? t.errors.unknown!);
    } else {
      flash(true, t.moved);
      router.refresh();
    }
  }

  function dayFromEvent(e: React.DragEvent | React.PointerEvent, el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    return Math.max(0, Math.min(days - 1, Math.floor((e.clientX - rect.left) / cw)));
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>, roomId: string | null) {
    e.preventDefault();
    if (!dragging) return;
    const day = dayFromEvent(e, e.currentTarget);
    const b = bookings.find((x) => x.id === dragging.id);
    setDragging(null);
    setHover(null);
    if (!b) return;
    const checkIn = addDays(start, day - dragging.grab);
    const nights = diffDays(b.checkOut, b.checkIn);
    const checkOut = addDays(checkIn, nights);
    const patch: { roomId?: string | null; checkIn?: string; checkOut?: string } = {};
    if (roomId !== b.roomId) patch.roomId = roomId;
    if (checkIn !== b.checkIn) {
      patch.checkIn = checkIn;
      patch.checkOut = checkOut;
    }
    if (Object.keys(patch).length) void commitMove(b.id, patch);
  }

  function startResize(e: React.PointerEvent, b: Booking) {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const baseNights = diffDays(b.checkOut, b.checkIn);
    let current = baseNights;
    const move = (ev: PointerEvent) => {
      current = Math.max(1, baseNights + Math.round((ev.clientX - startX) / cw));
      setResize({ id: b.id, nights: current });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setResize(null);
      if (current !== baseNights) void commitMove(b.id, { checkOut: addDays(b.checkIn, current) });
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  const money = (n: number) => formatCurrency(n, currency, locale, 0);
  const sources = [...new Set(bookings.map((b) => b.source))];

  return (
    <div className="mx-auto max-w-[1600px]">
      <PageHero
        eyebrow={t.eyebrow}
        title={t.title}
        subtitle={t.subtitle}
        actions={
          <>
            {live && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs text-ionian-100">
                <Radio className="size-3.5 animate-pulse text-olive-400" /> {t.live}
              </span>
            )}
            <Link href={href({ start: addDays(start, -Math.floor(days / 2)) })} className="grid size-10 place-items-center rounded-full border border-white/15 hover:bg-white/10" aria-label={t.prev}>
              <ChevronLeft className="size-4" />
            </Link>
            <Link href={href({ start: addDays(today, -2) })} className="inline-flex h-10 items-center rounded-full bg-limestone-50 px-5 text-sm font-medium text-ionian-950">
              {t.today}
            </Link>
            <Link href={href({ start: addDays(start, Math.floor(days / 2)) })} className="grid size-10 place-items-center rounded-full border border-white/15 hover:bg-white/10" aria-label={t.next}>
              <ChevronRight className="size-4" />
            </Link>
            <span className="mx-1 hidden h-6 w-px bg-white/15 sm:block" />
            {spans.map((s) => (
              <Link
                key={s}
                href={href({ days: s })}
                className={cn('inline-flex h-10 items-center rounded-full px-4 text-xs', s === days ? 'bg-white/15 text-gold-400' : 'text-ionian-200 hover:bg-white/10')}
              >
                {t.span(s)}
              </Link>
            ))}
          </>
        }
      />

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
        <span className="tracking-wider uppercase">{t.legend}</span>
        {sources.map((s) => (
          <span key={s} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: SOURCE_COLOR[s as BookingSource] }} />
            {t.source[s]}
          </span>
        ))}
      </div>

      <div className="relative mt-4 overflow-hidden rounded-2xl border border-border bg-surface shadow-soft">
        <div className="overflow-x-auto">
          <div style={{ width: RAIL + width }}>
            {/* header */}
            <div className="sticky top-0 z-20 flex border-b border-border bg-surface/95 backdrop-blur">
              <div className="sticky left-0 z-30 flex items-end bg-surface px-4 pb-2 text-[11px] tracking-wider text-subtle uppercase" style={{ width: RAIL }}>
                {t.rooms}
              </div>
              {dates.map((d) => {
                const wd = dow(d);
                const isToday = d === today;
                const weekend = wd === 0 || wd === 6;
                return (
                  <div
                    key={d}
                    style={{ width: cw }}
                    className={cn('flex flex-col items-center border-l border-border py-1.5 text-[11px]', weekend && 'bg-surface-2/60', isToday && 'bg-gold-400/15')}
                  >
                    <span className="text-subtle">{t.weekdays[wd]}</span>
                    <span className={cn('font-serif text-xl leading-tight tabular-nums', isToday && 'text-accent')}>{Number(d.slice(8))}</span>
                    <span className="h-3 text-[9px] tracking-wider text-subtle uppercase">
                      {d.endsWith('-01') || d === start ? formatDay(d, locale, { month: 'short' }) : ''}
                    </span>
                  </div>
                );
              })}
            </div>

            {data.types.map((type) => {
              const typeRooms = data.rooms.filter((r) => r.roomTypeId === type.id);
              const sellable = typeRooms.filter((r) => r.status !== 'out_of_order').length;
              const unassigned = byRoom.get(`type:${type.id}`) ?? [];
              return (
                <section key={type.id}>
                  {/* type header with availability + rates */}
                  <div className="flex border-b border-border bg-surface-2/70">
                    <div className="sticky left-0 z-10 flex items-center justify-between gap-2 bg-surface-2 px-4 py-1.5" style={{ width: RAIL }}>
                      <span className="truncate text-xs font-medium">{type.name}</span>
                      <span className="text-[10px] text-subtle tabular-nums">{typeRooms.length}</span>
                    </div>
                    {dates.map((d) => {
                      const used = bookings.filter((b) => b.roomTypeId === type.id && b.checkIn <= d && b.checkOut > d).length;
                      const freeN = Math.max(0, sellable - used);
                      const rate = rateByKey.get(`${type.id}|${d}`);
                      const price = rate?.price ?? type.basePrice;
                      const Cell = manager ? 'button' : 'div';
                      return (
                        <Cell
                          key={d}
                          type={manager ? 'button' : undefined}
                          onClick={manager ? () => setRateEdit({ typeId: type.id, date: d }) : undefined}
                          title={manager ? t.rates.edit : undefined}
                          style={{ width: cw }}
                          className={cn(
                            'flex flex-col items-center justify-center border-l border-border py-1 text-[10px] leading-tight transition-colors',
                            manager && 'hover:bg-surface-3',
                            rate?.closed && 'bg-danger-soft',
                          )}
                        >
                          <span className={cn('font-medium tabular-nums', freeN === 0 ? 'text-danger' : freeN <= 1 ? 'text-accent' : 'text-success')}>{freeN}</span>
                          <span className={cn('tabular-nums', rate?.closed ? 'text-danger' : 'text-subtle')}>{rate?.closed ? '×' : Math.round(price)}</span>
                        </Cell>
                      );
                    })}
                  </div>

                  {/* unassigned lane */}
                  {unassigned.length > 0 && (
                    <div className="flex border-b border-border">
                      <div className="sticky left-0 z-10 flex items-center bg-surface px-4 text-xs text-danger" style={{ width: RAIL }}>
                        {t.unassigned}
                      </div>
                      <Track
                        dates={dates}
                        cw={cw}
                        today={today}
                        rowHeight={ROW}
                        lanes={unassigned.length}
                        onDrop={(e) => onDrop(e, null)}
                        onOver={(day) => setHover({ roomId: null, day })}
                        hover={hover?.roomId === null && dragging ? hover.day : null}
                        dragging={Boolean(dragging)}
                      >
                        {unassigned.map((b, lane) => (
                          <Bar key={b.id} b={b} lane={lane} start={start} days={days} cw={cw} t={t} dragging={dragging?.id === b.id} resizeNights={resize?.id === b.id ? resize.nights : null} onOpen={setDetail} onDragStart={(e) => beginDrag(e, b, setDragging, start, cw)} onDragEnd={() => { setDragging(null); setHover(null); }} onResize={(e) => startResize(e, b)} />
                        ))}
                      </Track>
                    </div>
                  )}

                  {typeRooms.map((room) => {
                    const list = byRoom.get(room.id) ?? [];
                    const blocked = room.status === 'out_of_order';
                    return (
                      <div key={room.id} className="flex border-b border-border">
                        <div className="sticky left-0 z-10 flex items-center gap-2 border-r border-border bg-surface px-4 text-sm" style={{ width: RAIL, height: ROW }}>
                          <span className={cn('size-2 rounded-full', room.status === 'clean' && 'bg-olive-500', room.status === 'inspected' && 'bg-ionian-500', room.status === 'dirty' && 'bg-gold-500', blocked && 'bg-danger')} />
                          <span className="font-medium tabular-nums">{room.number}</span>
                          <span className="text-[10px] text-subtle">{room.floor}</span>
                        </div>
                        <Track
                          dates={dates}
                          cw={cw}
                          today={today}
                          rowHeight={ROW}
                          lanes={1}
                          blocked={blocked}
                          onDrop={(e) => onDrop(e, room.id)}
                          onOver={(day) => setHover({ roomId: room.id, day })}
                          hover={hover?.roomId === room.id && dragging ? hover.day : null}
                          dragging={Boolean(dragging)}
                          onEmptyClick={(day) => setQuick({ roomId: room.id, date: addDays(start, day) })}
                        >
                          {list.map((b) => (
                            <Bar key={b.id} b={b} lane={0} start={start} days={days} cw={cw} t={t} dragging={dragging?.id === b.id} resizeNights={resize?.id === b.id ? resize.nights : null} onOpen={setDetail} onDragStart={(e) => beginDrag(e, b, setDragging, start, cw)} onDragEnd={() => { setDragging(null); setHover(null); }} onResize={(e) => startResize(e, b)} />
                          ))}
                        </Track>
                      </div>
                    );
                  })}
                </section>
              );
            })}
          </div>
        </div>
      </div>

      {toast && (
        <div className={cn('animate-fade-up fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full px-5 py-2.5 text-sm shadow-float', toast.ok ? 'bg-ionian-950 text-limestone-50' : 'bg-danger text-white')}>
          {toast.text}
        </div>
      )}

      <Sheet open={Boolean(detail)} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent closeLabel="×" className="max-w-sm">
          {detail && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {detail.isVip && <Crown className="size-4 text-gold-500" />}
                  {detail.firstName} {detail.lastName}
                </SheetTitle>
                <p className="text-sm text-muted">{t.status[detail.status]}</p>
              </SheetHeader>
              <dl className="space-y-4 p-6 text-sm">
                {[
                  [t.detail.code, detail.code],
                  [t.detail.stay, `${formatDay(detail.checkIn, locale, { day: 'numeric', month: 'short' })} → ${formatDay(detail.checkOut, locale, { day: 'numeric', month: 'short' })} · ${t.nights(diffDays(detail.checkOut, detail.checkIn))}`],
                  [t.detail.guests, String(detail.adults + detail.children)],
                  [t.detail.source, t.source[detail.source] ?? detail.source],
                  [t.detail.total, money(detail.total)],
                  [t.detail.paid, money(detail.paid)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 border-b border-border pb-3">
                    <dt className="text-muted">{k}</dt>
                    <dd className="text-right font-medium">{v}</dd>
                  </div>
                ))}
                <Button asChild className="w-full">
                  <IntlLink href={`/app/bookings?b=${detail.id}`}>
                    {t.detail.open} <ArrowUpRight />
                  </IntlLink>
                </Button>
              </dl>
            </>
          )}
        </SheetContent>
      </Sheet>

      {quick && <QuickBooking key={`${quick.roomId}${quick.date}`} data={data} quick={quick} locale={locale} onClose={() => setQuick(null)} onDone={() => { setQuick(null); router.refresh(); }} />}
      {rateEdit && manager && <RateEditor key={`${rateEdit.typeId}${rateEdit.date}`} data={data} edit={rateEdit} locale={locale} onClose={() => setRateEdit(null)} onDone={(n) => { setRateEdit(null); flash(true, t.rates.saved(n)); router.refresh(); }} />}
    </div>
  );
}

function beginDrag(
  e: React.DragEvent,
  b: Booking,
  setDragging: (v: { id: string; grab: number } | null) => void,
  start: string,
  cw: number,
) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const nights = diffDays(b.checkOut, b.checkIn);
  const grab = Math.max(0, Math.min(nights - 1, Math.floor((e.clientX - rect.left) / cw)));
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', b.id);
  void start;
  setDragging({ id: b.id, grab });
}

function Track({
  dates,
  cw,
  today,
  rowHeight,
  lanes,
  blocked,
  hover,
  dragging,
  onDrop,
  onOver,
  onEmptyClick,
  children,
}: {
  dates: string[];
  cw: number;
  today: string;
  rowHeight: number;
  lanes: number;
  blocked?: boolean;
  hover: number | null;
  dragging: boolean;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onOver: (day: number) => void;
  onEmptyClick?: (day: number) => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const todayIdx = dates.indexOf(today);
  return (
    <div
      ref={ref}
      className={cn('relative', blocked && 'bg-[repeating-linear-gradient(135deg,transparent_0_6px,var(--danger-soft)_6px_12px)]')}
      style={{ width: dates.length * cw, height: rowHeight * lanes }}
      onDragOver={(e) => {
        if (!dragging) return;
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        onOver(Math.max(0, Math.min(dates.length - 1, Math.floor((e.clientX - rect.left) / cw))));
      }}
      onDrop={onDrop}
      onClick={(e) => {
        if (!onEmptyClick || blocked || e.target !== e.currentTarget) return;
        const rect = e.currentTarget.getBoundingClientRect();
        onEmptyClick(Math.max(0, Math.min(dates.length - 1, Math.floor((e.clientX - rect.left) / cw))));
      }}
    >
      {/* grid lines + weekend shading */}
      <div className="pointer-events-none absolute inset-0 flex">
        {dates.map((d) => {
          const wd = dow(d);
          return <div key={d} style={{ width: cw }} className={cn('border-l border-border', (wd === 0 || wd === 6) && 'bg-surface-2/50')} />;
        })}
      </div>
      {todayIdx >= 0 && <div className="pointer-events-none absolute inset-y-0 w-px bg-gold-500/70" style={{ left: (todayIdx + 0.5) * cw }} />}
      {hover !== null && <div className="pointer-events-none absolute inset-y-1 rounded-md bg-ionian-500/15 ring-2 ring-ionian-400/60" style={{ left: hover * cw, width: cw }} />}
      {children}
    </div>
  );
}

function Bar({
  b,
  lane,
  start,
  days,
  cw,
  t,
  dragging,
  resizeNights,
  onOpen,
  onDragStart,
  onDragEnd,
  onResize,
}: {
  b: Booking;
  lane: number;
  start: string;
  days: number;
  cw: number;
  t: ReturnType<typeof pickCalendarCopy>;
  dragging: boolean;
  resizeNights: number | null;
  onOpen: (b: Booking) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onResize: (e: React.PointerEvent) => void;
}) {
  const nights = resizeNights ?? diffDays(b.checkOut, b.checkIn);
  const from = diffDays(b.checkIn, start);
  const left = Math.max(0, (from + 0.5) * cw);
  const right = Math.min(days * cw, (from + nights + 0.5) * cw);
  if (right <= left) return null;
  const color = SOURCE_COLOR[b.source as BookingSource];
  const fresh = Date.now() - new Date(b.createdAt).getTime() < 120_000;
  const clippedLeft = from < 0;
  const clippedRight = (from + nights + 0.5) * cw > days * cw;
  const canMove = b.status !== 'checked_out';

  return (
    <div
      draggable={canMove}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(b)}
      title={`${b.firstName} ${b.lastName} · ${b.code} · ${t.status[b.status]}`}
      className={cn(
        'group absolute flex items-center gap-1.5 overflow-hidden rounded-md px-2 text-[11px] font-medium text-white shadow-soft transition-[transform,box-shadow,opacity] select-none',
        canMove ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        'hover:z-10 hover:-translate-y-px hover:shadow-lift',
        dragging && 'opacity-40',
        fresh && 'animate-pulse-land',
        b.status === 'tentative' && 'border-2 border-dashed border-white/70',
        b.status === 'checked_out' && 'opacity-45 saturate-50',
        clippedLeft && 'rounded-l-none',
        clippedRight && 'rounded-r-none',
      )}
      style={{ left, width: right - left, top: lane * ROW + 6, height: ROW - 12, background: color }}
    >
      {b.status === 'checked_in' && <span className="size-1.5 shrink-0 rounded-full bg-white shadow-[0_0_0_3px_rgb(255_255_255/0.25)]" />}
      {b.isVip && <Crown className="size-3 shrink-0" />}
      <span className="truncate">{b.firstName} {b.lastName}</span>
      {right - left > cw * 3 && <span className="ml-auto shrink-0 opacity-75">{t.nights(nights)}</span>}
      {canMove && !clippedRight && (
        <span
          onPointerDown={onResize}
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-y-0 right-0 flex w-3 cursor-ew-resize items-center justify-center bg-black/0 hover:bg-black/20"
        >
          <span className="h-3 w-0.5 rounded-full bg-white/70" />
        </span>
      )}
    </div>
  );
}

function QuickBooking({
  data,
  quick,
  locale,
  onClose,
  onDone,
}: {
  data: CalendarData;
  quick: { roomId: string; date: string };
  locale: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const t = pickCalendarCopy(locale);
  const act = useAction(t.errors);
  const [roomId, setRoomId] = useState(quick.roomId);
  const [checkIn, setCheckIn] = useState(quick.date);
  const [nights, setNights] = useState(1);
  const [adults, setAdults] = useState(2);
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [phone, setPhone] = useState('');
  const [source, setSource] = useState<'direct' | 'phone' | 'walk_in' | 'whatsapp' | 'booking_com' | 'airbnb'>('phone');
  const [status, setStatus] = useState<'confirmed' | 'tentative'>('confirmed');
  const room = data.rooms.find((r) => r.id === roomId);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!room) return;
    act.run(
      () =>
        createBooking({
          roomTypeId: room.roomTypeId,
          roomId: room.id,
          autoAssign: false,
          checkIn,
          checkOut: addDays(checkIn, nights),
          adults,
          children: 0,
          source,
          status,
          guest: { firstName: first, lastName: last, phone: phone || undefined },
        }),
      onDone,
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel="×">
        <DialogHeader>
          <DialogTitle>{t.quick.title}</DialogTitle>
          <DialogDescription>{room ? `${t.quick.room} ${room.number}` : ''}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>{t.quick.room}</Label>
            <select className={selectCls} value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              {data.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.number} · {data.types.find((x) => x.id === r.roomTypeId)?.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>{t.quick.checkIn}</Label>
            <Input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t.quick.nights}</Label>
              <Input type="number" min={1} max={60} value={nights} onChange={(e) => setNights(Math.max(1, Number(e.target.value)))} />
            </div>
            <div>
              <Label>{t.quick.adults}</Label>
              <Input type="number" min={1} max={12} value={adults} onChange={(e) => setAdults(Math.max(1, Number(e.target.value)))} />
            </div>
          </div>
          <div>
            <Label>{t.quick.firstName}</Label>
            <Input value={first} onChange={(e) => setFirst(e.target.value)} required />
          </div>
          <div>
            <Label>{t.quick.lastName}</Label>
            <Input value={last} onChange={(e) => setLast(e.target.value)} required />
          </div>
          <div className="col-span-2">
            <Label>{t.quick.phone}</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
          </div>
          <div>
            <Label>{t.quick.source}</Label>
            <select className={selectCls} value={source} onChange={(e) => setSource(e.target.value as typeof source)}>
              {(['phone', 'walk_in', 'direct', 'whatsapp', 'booking_com', 'airbnb'] as const).map((s) => (
                <option key={s} value={s}>{t.source[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>{t.quick.status}</Label>
            <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="confirmed">{t.status.confirmed}</option>
              <option value="tentative">{t.status.tentative}</option>
            </select>
          </div>
          {act.message && <p className="col-span-2 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{act.message}</p>}
          <DialogFooter className="col-span-2">
            <Button type="button" variant="ghost" onClick={onClose}>{t.quick.cancel}</Button>
            <Button type="submit" disabled={act.pending}>{act.pending ? t.quick.creating : t.quick.create}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RateEditor({
  data,
  edit,
  locale,
  onClose,
  onDone,
}: {
  data: CalendarData;
  edit: { typeId: string; date: string };
  locale: string;
  onClose: () => void;
  onDone: (days: number) => void;
}) {
  const t = pickCalendarCopy(locale);
  const act = useAction(t.errors);
  const [typeId, setTypeId] = useState(edit.typeId);
  const [from, setFrom] = useState(edit.date);
  const [to, setTo] = useState(edit.date);
  const [price, setPrice] = useState('');
  const [pct, setPct] = useState('');
  const [minStay, setMinStay] = useState('');
  const [closed, setClosed] = useState<'keep' | 'closed' | 'open'>('keep');
  const [wd, setWd] = useState<number[]>([]);
  const order = [1, 2, 3, 4, 5, 6, 0];

  function submit(e: React.FormEvent) {
    e.preventDefault();
    act.run(
      () =>
        setRates({
          roomTypeId: typeId,
          from,
          to,
          price: price ? Number(price) : undefined,
          adjustPct: !price && pct ? Number(pct) : undefined,
          minStay: minStay ? Number(minStay) : undefined,
          closed: closed === 'keep' ? undefined : closed === 'closed',
          weekdays: wd.length ? wd : undefined,
        }),
      (r) => onDone(r.days),
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel="×">
        <DialogHeader>
          <DialogTitle>{t.rates.title}</DialogTitle>
          <DialogDescription>{t.rates.hint}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>{t.rates.type}</Label>
            <select className={selectCls} value={typeId} onChange={(e) => setTypeId(e.target.value)}>
              {data.types.map((x) => (
                <option key={x.id} value={x.id}>{x.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>{t.rates.from}</Label>
            <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); if (e.target.value > to) setTo(e.target.value); }} required />
          </div>
          <div>
            <Label>{t.rates.to}</Label>
            <Input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} required />
          </div>
          <div>
            <Label>{t.rates.price}</Label>
            <Input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div>
            <Label>{t.rates.pct}</Label>
            <Input type="number" min={-90} max={300} step="1" value={pct} onChange={(e) => setPct(e.target.value)} disabled={Boolean(price)} placeholder="+15" />
          </div>
          <div>
            <Label>{t.rates.minStay}</Label>
            <Input type="number" min={1} max={30} value={minStay} onChange={(e) => setMinStay(e.target.value)} />
          </div>
          <div>
            <Label>{t.rates.closed}</Label>
            <select className={selectCls} value={closed} onChange={(e) => setClosed(e.target.value as typeof closed)}>
              <option value="keep">{t.rates.keep}</option>
              <option value="closed">{t.rates.closed}</option>
              <option value="open">{t.rates.open}</option>
            </select>
          </div>
          <div className="col-span-2">
            <Label>{t.rates.days}</Label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {order.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setWd((w) => (w.includes(d) ? w.filter((x) => x !== d) : [...w, d]))}
                  className={cn('h-8 rounded-full border px-3 text-xs', wd.includes(d) ? 'border-ionian-600 bg-ionian-800 text-limestone-50' : 'border-border-strong text-muted hover:bg-surface-2')}
                >
                  {t.weekdays[d]}
                </button>
              ))}
              <button type="button" onClick={() => setWd([])} className="h-8 rounded-full px-3 text-xs text-subtle hover:text-foreground">{t.rates.all}</button>
            </div>
          </div>
          {act.message && <p className="col-span-2 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{act.message}</p>}
          <DialogFooter className="col-span-2">
            <Button type="button" variant="ghost" onClick={onClose}>{t.quick.cancel}</Button>
            <Button type="submit" disabled={act.pending}><SlidersHorizontal /> {t.rates.save}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
