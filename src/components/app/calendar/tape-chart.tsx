'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { ChevronLeft, ChevronRight, Crown, Lock, Minus, Plus, SlidersHorizontal, Wrench } from 'lucide-react';
import { SOURCE_COLOR } from '@/config/channels';
import { addDays, capitalize, diffDays, formatDay } from '@/lib/dates';
import { formatCurrency, type Currency } from '@/lib/format';
import { cn, localized } from '@/lib/utils';
import { assignRoom } from '@/server/actions/bookings';
import type { CalendarBooking, CalendarData } from '@/server/queries/calendar';
import { pickCopy as pickBookingCopy } from '../bookings/copy';
import { pickCalendarCopy } from './copy';
import { RatesSheet, type RateTarget } from './rates-sheet';
import { StayChangeSheet, type PendingChange } from './stay-change-sheet';
import { useLiveRefresh } from './use-live-refresh';

const ZOOMS = [32, 48, 72] as const;
const ROW_H = 40;
const TYPE_H = 38;
const LABEL_W = 136;
const UNASSIGNED = '__unassigned';
const WINDOWS = [14, 30, 60] as const;
const LIVE_TABLES = ['bookings', 'rooms', 'daily_rates'] as const;
const HOLD = new Set(['tentative', 'confirmed', 'checked_in']);
const ROOM_DOT = { clean: 'bg-olive-700/60', inspected: 'bg-olive-700', dirty: 'bg-accent', out_of_order: 'bg-danger' } as const;
const HATCH = 'repeating-linear-gradient(135deg, color-mix(in oklab, var(--color-danger) 12%, transparent) 0 6px, transparent 6px 12px)';

const dow = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay();
const isWeekend = (d: string) => dow(d) === 0 || dow(d) === 6;
const canEdit = (b: CalendarBooking) => HOLD.has(b.status);

type Drag = { id: string; mode: 'move' | 'resize'; dDays: number; row: string; dy: number };

function packLanes(items: CalendarBooking[]) {
  const ends: string[] = [];
  const lane = new Map<string, number>();
  for (const b of [...items].sort((a, z) => a.checkIn.localeCompare(z.checkIn))) {
    let i = ends.findIndex((end) => end <= b.checkIn);
    if (i === -1) {
      i = ends.length;
      ends.push(b.checkOut);
    } else {
      ends[i] = b.checkOut;
    }
    lane.set(b.id, i);
  }
  return { items, lane, lanes: Math.max(1, ends.length) };
}

type Props = {
  data: CalendarData;
  from: string;
  days: number;
  today: string;
  locale: string;
  currency: Currency;
  manager: boolean;
};

export function TapeChart({ data, from, days, today, locale, currency, manager }: Props) {
  const t = pickCalendarCopy(locale);
  const bt = pickBookingCopy(locale);
  const router = useRouter();
  const pathname = usePathname();
  const scroller = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const dayW = ZOOMS[zoom] ?? 48;
  const [overrides, setOverrides] = useState<Record<string, Partial<CalendarBooking>>>({});
  const [drag, setDrag] = useState<Drag | null>(null);
  const [change, setChange] = useState<PendingChange | null>(null);
  const [rateTarget, setRateTarget] = useState<RateTarget | null>(null);
  const [toast, setToast] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [pulse, setPulse] = useState<ReadonlySet<string>>(new Set());
  const [, startTransition] = useTransition();
  const live = useLiveRefresh(data.orgId, LIVE_TABLES);

  const errorText = (code: string) => t.errors[code] ?? bt.errors[code] ?? bt.errors.unknown ?? code;
  const money = (n: number) => formatCurrency(n, currency, locale, 2);
  const flash = (code: string) => setToast({ tone: 'error', text: errorText(code) });
  const revert = (id: string) =>
    setOverrides((o) => {
      const { [id]: _drop, ...rest } = o;
      return rest;
    });

  // Fresh server data replaces optimistic state.
  useEffect(() => setOverrides({}), [data]);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(id);
  }, [toast]);

  // Bookings that appear while the page is open "land" with a pulse.
  const windowKey = `${from}:${days}`;
  const seen = useRef<{ key: string; ids: Set<string> } | null>(null);
  useEffect(() => {
    const ids = new Set(data.bookings.map((b) => b.id));
    const prev = seen.current;
    seen.current = { key: windowKey, ids };
    if (!prev || prev.key !== windowKey) return;
    const fresh = [...ids].filter((id) => !prev.ids.has(id));
    if (fresh.length === 0) return;
    setPulse(new Set(fresh));
    const timer = setTimeout(() => setPulse(new Set()), 2000);
    return () => clearTimeout(timer);
  }, [data.bookings, windowKey]);

  const dates = useMemo(() => Array.from({ length: days }, (_, i) => addDays(from, i)), [from, days]);
  const todayIdx = diffDays(today, from);
  const roomById = useMemo(() => new Map(data.rooms.map((r) => [r.id, r])), [data.rooms]);
  const inventory = useMemo(() => new Map(data.inventory.map((i) => [i.roomTypeId, i.days])), [data.inventory]);
  const list = useMemo(
    () => data.bookings.map((b) => (overrides[b.id] ? { ...b, ...overrides[b.id] } : b)),
    [data.bookings, overrides],
  );
  const byRoom = useMemo(() => {
    const m = new Map<string, CalendarBooking[]>();
    for (const b of list) {
      if (!b.roomId) continue;
      const arr = m.get(b.roomId) ?? [];
      arr.push(b);
      m.set(b.roomId, arr);
    }
    return m;
  }, [list]);
  const unassigned = useMemo(() => packLanes(list.filter((b) => !b.roomId && HOLD.has(b.status))), [list]);
  const groups = useMemo(
    () =>
      data.types
        .map((type) => ({ type, rooms: data.rooms.filter((r) => r.roomTypeId === type.id) }))
        .filter((g) => g.rooms.length > 0),
    [data.types, data.rooms],
  );
  const sources = useMemo(() => [...new Set(data.bookings.map((b) => b.source))], [data.bookings]);

  const clashes = (roomId: string, checkIn: string, checkOut: string, id: string) =>
    (byRoom.get(roomId) ?? []).some((o) => o.id !== id && HOLD.has(o.status) && o.checkIn < checkOut && o.checkOut > checkIn);

  const geom = (b: CalendarBooking) => {
    const s = diffDays(b.checkIn, from);
    const e = diffDays(b.checkOut, from);
    const cs = Math.max(0, s);
    const ce = Math.min(days, e);
    return { left: cs * dayW, width: Math.max(0, ce - cs) * dayW, cutStart: s < 0, cutEnd: e > days };
  };

  const track = (hatch = false): React.CSSProperties => ({
    width: days * dayW,
    backgroundImage: [hatch ? HATCH : null, 'linear-gradient(to right, var(--color-border) 1px, transparent 1px)']
      .filter(Boolean)
      .join(', '),
    backgroundSize: hatch ? `auto, ${dayW}px 100%` : `${dayW}px 100%`,
  });

  const openBooking = (id: string) =>
    router.push(`${pathname.replace(/\/calendar$/, '/bookings')}?view=all&b=${id}`, { scroll: false });

  const hrefFor = (nextFrom: string, nextDays: number = days) => {
    const p = new URLSearchParams({ from: nextFrom });
    if (nextDays !== 30) p.set('days', String(nextDays));
    return `${pathname}?${p.toString()}`;
  };
  const step = days === 14 ? 7 : days === 30 ? 14 : 30;

  /* ───────────── Drag & drop ───────────── */

  function commit(b: CalendarBooking, d: Drag) {
    const checkIn = d.mode === 'move' ? addDays(b.checkIn, d.dDays) : b.checkIn;
    const checkOut = addDays(b.checkOut, d.dDays);
    const roomId = d.mode === 'move' ? (d.row === UNASSIGNED ? null : d.row) : b.roomId;
    const datesChanged = d.dDays !== 0;
    if (!datesChanged && roomId === b.roomId) return;

    const room = roomId ? roomById.get(roomId) : undefined;
    if (room?.status === 'out_of_order') return flash('roomInvalid');
    if (roomId && clashes(roomId, checkIn, checkOut, b.id)) return flash('roomTaken');

    setOverrides((o) => ({ ...o, [b.id]: { roomId, checkIn, checkOut, roomTypeId: room?.roomTypeId ?? b.roomTypeId } }));

    if (!datesChanged) {
      // Room-only move: same rules as the bookings screen (upgrades, in-house moves, cleaning tasks).
      startTransition(async () => {
        const res = await assignRoom({ bookingId: b.id, roomId });
        if (!res.ok) {
          revert(b.id);
          flash(res.error);
        } else {
          setToast({ tone: 'ok', text: room ? t.moved(room.number) : t.unassignedOk });
        }
      });
      return;
    }
    setChange({ booking: b, roomId, checkIn, checkOut });
  }

  function startDrag(e: React.PointerEvent<HTMLElement>, b: CalendarBooking, mode: 'move' | 'resize', laneTop: number) {
    if (e.button !== 0) return;
    e.stopPropagation();
    const el = scroller.current;
    const originRow = e.currentTarget.closest<HTMLElement>('[data-row]');
    if (!el || !originRow) return;

    const editable = canEdit(b);
    const inHouse = b.status === 'checked_in';
    const nights = diffDays(b.checkOut, b.checkIn);
    const x0 = e.clientX;
    const y0 = e.clientY;
    const s0 = el.scrollLeft;
    const originId = originRow.dataset.row ?? '';
    let moved = false;
    let cur: Drag | null = null;

    const onMove = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return;
      moved = true;
      if (!editable) return;

      const box = el.getBoundingClientRect();
      if (ev.clientX > box.right - 40) el.scrollLeft += 14;
      else if (ev.clientX < box.left + LABEL_W + 20) el.scrollLeft -= 14;
      if (ev.clientY > box.bottom - 30) el.scrollTop += 10;
      else if (ev.clientY < box.top + 70) el.scrollTop -= 10;

      const dx = ev.clientX - x0 + (el.scrollLeft - s0);
      let dDays = Math.round(dx / dayW);
      let row = cur?.row ?? originId;
      let dy = cur?.dy ?? 0;

      if (mode === 'resize') {
        dDays = Math.max(dDays, 1 - nights);
        if (inHouse) dDays = Math.max(dDays, diffDays(addDays(today, 1), b.checkOut));
        row = originId;
        dy = 0;
      } else {
        if (inHouse) dDays = 0;
        else if (dDays !== 0 && addDays(b.checkIn, dDays) < today) dDays = Math.max(dDays, diffDays(today, b.checkIn));
        const hit = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('[data-row]');
        const hitId = hit?.dataset.row;
        if (hit && hitId && !(inHouse && hitId === UNASSIGNED)) {
          row = hitId;
          dy = hit.getBoundingClientRect().top - originRow.getBoundingClientRect().top - laneTop;
        }
      }

      if (!cur || cur.dDays !== dDays || cur.row !== row || cur.dy !== dy) {
        cur = { id: b.id, mode, dDays, row, dy };
        setDrag(cur);
      }
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      setDrag(null);
    };
    const onUp = () => {
      cleanup();
      if (!moved) return openBooking(b.id);
      if (cur) commit(b, cur);
    };
    const onCancel = () => cleanup();

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  }

  /* ───────────── Rendering ───────────── */

  function block(b: CalendarBooking, laneTop: number) {
    const g = geom(b);
    if (g.width <= 0) return null;
    const d = drag?.id === b.id ? drag : null;
    const color = SOURCE_COLOR[b.source];
    const nights = diffDays(b.checkOut, b.checkIn);
    const editable = canEdit(b);
    const tentative = b.status === 'tentative';
    const width = d?.mode === 'resize' ? Math.max(dayW, g.width + d.dDays * dayW) : g.width;
    const range = `${formatDay(b.checkIn, locale, { day: 'numeric', month: 'short' })} – ${formatDay(b.checkOut, locale, { day: 'numeric', month: 'short' })}`;

    return (
      <div
        key={b.id}
        role="button"
        tabIndex={0}
        aria-label={`${b.firstName} ${b.lastName}, ${range}`}
        title={`${b.firstName} ${b.lastName} · ${b.code} · ${bt.source[b.source]} · ${bt.nights(nights)} · ${bt.status[b.status]}`}
        onPointerDown={(e) => startDrag(e, b, 'move', laneTop)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openBooking(b.id);
          }
        }}
        className={cn(
          'group absolute z-10 flex items-center gap-1.5 overflow-hidden rounded-md px-2 text-[11px] font-medium text-white shadow-soft outline-none select-none touch-none focus-visible:ring-2 focus-visible:ring-ionian-400',
          g.cutStart && 'rounded-l-none',
          g.cutEnd && 'rounded-r-none',
          editable ? 'cursor-grab' : 'cursor-pointer',
          b.status === 'checked_out' && 'opacity-45 saturate-50',
          tentative && 'border border-dashed border-white/70',
          d && 'pointer-events-none z-40 cursor-grabbing shadow-float ring-2 ring-white/80',
          pulse.has(b.id) && 'animate-booking-land',
        )}
        style={{
          left: g.left + 1,
          top: laneTop + 4,
          width: width - 2,
          height: ROW_H - 8,
          background: tentative ? `color-mix(in oklab, ${color} 62%, transparent)` : color,
          transform: d?.mode === 'move' ? `translate(${d.dDays * dayW}px, ${d.dy}px)` : undefined,
        }}
      >
        {b.status === 'checked_in' && <span className="size-1.5 shrink-0 rounded-full bg-white" />}
        {b.isVip && <Crown className="size-3 shrink-0" />}
        <span className="truncate">{width < 80 ? b.lastName : `${b.firstName.charAt(0)}. ${b.lastName}`}</span>
        {width >= 120 && <span className="ml-auto shrink-0 tabular-nums opacity-75">{nights}</span>}
        {editable && !g.cutEnd && (
          <span
            aria-hidden
            onPointerDown={(e) => startDrag(e, b, 'resize', laneTop)}
            className="absolute inset-y-0 right-0 w-2 cursor-ew-resize bg-white/0 transition-colors group-hover:bg-white/35"
          />
        )}
      </div>
    );
  }

  const label = 'sticky left-0 z-20 flex shrink-0 items-center gap-2 border-r border-border px-3';
  const pill = 'inline-flex h-9 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-xs transition-colors hover:bg-surface-2';
  const firstType = data.types[0];

  return (
    <div className="mx-auto max-w-[1600px]">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.3em] text-gold-600 uppercase dark:text-gold-400">{t.eyebrow}</p>
          <h1 className="font-display mt-2 text-4xl tracking-tight md:text-5xl">{t.title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn(pill, 'pointer-events-none')}>
            <span className={cn('size-2 rounded-full', live ? 'bg-olive-700 animate-pulse' : 'bg-subtle')} />
            {live ? t.live : t.offline}
          </span>
          <div className="flex items-center gap-1">
            <Link href={hrefFor(addDays(from, -step))} scroll={false} className={pill} aria-label={t.prev}>
              <ChevronLeft className="size-4" />
            </Link>
            <Link href={hrefFor(addDays(today, -2))} scroll={false} className={pill}>
              {t.today}
            </Link>
            <Link href={hrefFor(addDays(from, step))} scroll={false} className={pill} aria-label={t.next}>
              <ChevronRight className="size-4" />
            </Link>
          </div>
          <div className="flex items-center gap-1">
            {WINDOWS.map((w) => (
              <Link key={w} href={hrefFor(from, w)} scroll={false} className={cn(pill, w === days && 'border-border-strong bg-surface-2 font-medium')}>
                {t.window(w)}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button type="button" className={pill} aria-label={t.zoomOut} disabled={zoom === 0} onClick={() => setZoom((z) => Math.max(0, z - 1))}>
              <Minus className="size-3.5" />
            </button>
            <button type="button" className={pill} aria-label={t.zoomIn} disabled={zoom === ZOOMS.length - 1} onClick={() => setZoom((z) => Math.min(ZOOMS.length - 1, z + 1))}>
              <Plus className="size-3.5" />
            </button>
          </div>
          {manager && firstType && (
            <button type="button" className={cn(pill, 'ai-glow')} onClick={() => setRateTarget({ roomTypeId: firstType.id, date: today })}>
              <SlidersHorizontal className="size-3.5" /> {t.rates}
            </button>
          )}
        </div>
      </header>

      <p className="mt-3 text-xs text-muted">
        {capitalize(formatDay(from, locale, { month: 'long', year: 'numeric' }))} · {t.hint}
      </p>

      {groups.length === 0 ? (
        <p className="bg-qilim mt-6 rounded-2xl border border-border py-24 text-center font-serif text-2xl text-muted">{t.noRooms}</p>
      ) : (
        <div
          ref={scroller}
          className="relative mt-4 max-h-[calc(100dvh-230px)] overflow-auto rounded-2xl border border-border bg-surface shadow-soft"
        >
          <div className="relative" style={{ width: LABEL_W + days * dayW }}>
            {/* Header */}
            <div className="sticky top-0 z-30 flex border-b border-border bg-surface/95 backdrop-blur">
              <div className={cn(label, 'z-30 bg-surface text-xs text-muted')} style={{ width: LABEL_W }}>
                {t.rooms(data.rooms.length)}
              </div>
              {dates.map((d, i) => (
                <div
                  key={d}
                  style={{ width: dayW }}
                  className={cn(
                    'flex shrink-0 flex-col items-center justify-center border-r border-border/60 py-1.5 text-[10px] leading-tight',
                    isWeekend(d) && 'bg-surface-2/70',
                    i === todayIdx && 'bg-gold-400/15 text-gold-600 dark:text-gold-400',
                  )}
                >
                  <span className={cn('tracking-wide uppercase', d.endsWith('-01') ? 'text-accent' : 'text-subtle')}>
                    {d.endsWith('-01')
                      ? formatDay(d, locale, { month: 'short' })
                      : formatDay(d, locale, { weekday: dayW >= 48 ? 'short' : 'narrow' })}
                  </span>
                  <span className="font-serif text-base tabular-nums">{formatDay(d, locale, { day: 'numeric' })}</span>
                </div>
              ))}
            </div>

            {/* Body */}
            <div className="relative">
              <div aria-hidden className="pointer-events-none absolute inset-y-0" style={{ left: LABEL_W, width: days * dayW }}>
                {dates.map((d, i) =>
                  isWeekend(d) || i === todayIdx ? (
                    <div
                      key={d}
                      className={cn('absolute inset-y-0', i === todayIdx ? 'bg-gold-400/10' : 'bg-surface-2/50')}
                      style={{ left: i * dayW, width: dayW }}
                    />
                  ) : null,
                )}
              </div>

              {/* Unassigned lane */}
              <div
                data-row={UNASSIGNED}
                className={cn('relative flex border-b border-border', drag?.mode === 'move' && drag.row === UNASSIGNED && 'bg-gold-400/10')}
                style={{ height: unassigned.lanes * ROW_H }}
              >
                <div className={cn(label, 'bg-surface text-xs')} style={{ width: LABEL_W }}>
                  <span className="font-medium">{t.unassigned}</span>
                  {unassigned.items.length > 0 && (
                    <span className="rounded-full bg-gold-400/20 px-1.5 text-[10px] text-gold-600 tabular-nums dark:text-gold-400">
                      {unassigned.items.length}
                    </span>
                  )}
                </div>
                <div className="relative" style={track()}>
                  {unassigned.items.map((b) => block(b, (unassigned.lane.get(b.id) ?? 0) * ROW_H))}
                </div>
              </div>

              {groups.map(({ type, rooms: typeRooms }) => {
                const cells = inventory.get(type.id) ?? [];
                return (
                  <div key={type.id}>
                    {/* Inventory / rates row */}
                    <div className="relative flex border-b border-border bg-surface-2/80" style={{ height: TYPE_H }}>
                      <div className={cn(label, 'bg-surface-2 text-xs')} style={{ width: LABEL_W }}>
                        <span className="truncate font-medium">{localized(type.name, locale)}</span>
                      </div>
                      {cells.map((c) => {
                        const tone = c.closed
                          ? 'text-subtle'
                          : c.available <= 0
                            ? 'text-danger'
                            : c.available <= 2
                              ? 'text-g
