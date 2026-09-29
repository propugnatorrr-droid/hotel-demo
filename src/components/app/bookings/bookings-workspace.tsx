'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { ArrowUpRight, Crown, MessageCircle, Phone, Plus, Search } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { addDays, formatDay } from '@/lib/dates';
import { formatCurrency, type Currency } from '@/lib/format';
import { cn, localized } from '@/lib/utils';
import {
  assignRoom, cancelBooking, checkInBooking, checkOutBooking, confirmBooking, createBooking,
  getStayQuote, markNoShow, postCharge, recordPayment, voidCharge, type ActionResult,
} from '@/server/actions/bookings';
import type { BookingCounts, BookingDetail, BookingFormData, BookingRow, BookingView } from '@/server/queries/bookings';
import type { Quote } from '@/server/services/stay';
import { pickCopy, type BookingCopy } from './copy';

const VIEWS: BookingView[] = ['arrivals', 'inhouse', 'departures', 'upcoming', 'all'];

const STATUS_TONE: Record<string, string> = {
  tentative: 'bg-gold-400/15 text-gold-600 dark:text-gold-400',
  confirmed: 'bg-ionian-100 text-ionian-800 dark:bg-ionian-900 dark:text-ionian-100',
  checked_in: 'bg-olive-100 text-olive-700 dark:bg-olive-700/30 dark:text-olive-100',
  checked_out: 'bg-surface-2 text-muted',
  cancelled: 'bg-danger-soft text-danger',
  no_show: 'bg-danger-soft text-danger',
};

const input = 'h-10 w-full min-w-0 rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-border-strong';
const label = 'mb-1.5 block text-xs text-muted';

function useAction(t: BookingCopy) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function run<T>(fn: () => Promise<ActionResult<T>>, onOk?: (data: T) => void) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error);
      else onOk?.(res.data);
    });
  }
  return { pending, error, message: error ? t.errors[error] ?? t.errors.unknown : null, run };
}

type Props = {
  rows: BookingRow[];
  counts: BookingCounts;
  view: BookingView;
  q: string;
  detail: BookingDetail | null;
  form: BookingFormData;
  today: string;
  locale: string;
  currency: Currency;
  manager: boolean;
};

export function BookingsWorkspace({ rows, counts, view, q, detail, form, today, locale, currency, manager }: Props) {
  const t = pickCopy(locale);
  const router = useRouter();
  const pathname = usePathname();
  const [creating, setCreating] = useState(false);
  const money = (n: number) => formatCurrency(n, currency, locale, 2);

  const href = (next: { view?: BookingView; b?: string | null }) => {
    const p = new URLSearchParams();
    const v = next.view ?? view;
    if (v !== 'arrivals') p.set('view', v);
    if (q) p.set('q', q);
    if (next.b) p.set('b', next.b);
    const s = p.toString();
    return s ? `${pathname}?${s}` : pathname;
  };

  return (
    <div className="mx-auto max-w-7xl">
      <section className="relative overflow-hidden rounded-2xl bg-ionian-950 px-6 py-10 text-limestone-50 md:px-10 md:py-12">
        <div className="pointer-events-none absolute -top-40 -right-20 size-[28rem] rounded-full bg-ionian-500/25 blur-[100px]" />
        <div className="pointer-events-none absolute -bottom-48 left-10 size-[26rem] rounded-full bg-gold-400/10 blur-[110px]" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs tracking-[0.3em] text-gold-400 uppercase">{t.eyebrow}</p>
            <h1 className="font-display mt-4 text-5xl tracking-tight md:text-7xl">{t.title}</h1>
            <p className="mt-3 max-w-xl text-sm text-ionian-200">{t.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-limestone-50 px-5 text-sm font-medium text-ionian-950 transition-transform hover:-translate-y-0.5"
          >
            <Plus className="size-4" /> {t.newBooking}
          </button>
        </div>

        <nav className="relative mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-white/10 sm:grid-cols-5">
          {VIEWS.map((v) => (
            <Link
              key={v}
              href={href({ view: v, b: null })}
              scroll={false}
              className={cn(
                'bg-ionian-950/60 px-4 py-4 transition-colors hover:bg-white/5',
                view === v && 'bg-white/10',
              )}
            >
              <p className="font-serif text-4xl tabular-nums">{counts[v]}</p>
              <p className={cn('mt-1 text-xs', view === v ? 'text-gold-400' : 'text-ionian-200')}>{t.views[v]}</p>
            </Link>
          ))}
        </nav>
      </section>

      <form method="get" action={pathname} className="mt-6 flex items-center gap-2">
        {view !== 'arrivals' && <input type="hidden" name="view" value={view} />}
        <label className="flex h-11 flex-1 items-center gap-2 rounded-full border border-border bg-surface px-4">
          <Search className="size-4 text-subtle" />
          <input name="q" defaultValue={q} placeholder={t.search} className="w-full bg-transparent text-sm outline-none" />
        </label>
      </form>

      <div className="mt-4 space-y-2">
        {rows.length === 0 && <p className="py-20 text-center font-serif text-2xl text-muted">{t.empty}</p>}
        {rows.map((r, i) => (
          <button
            key={r.id}
            type="button"
            onClick={() => router.push(href({ b: r.id }), { scroll: false })}
            style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}
            className="animate-fade-up group grid w-full grid-cols-[auto_1fr_auto] items-center gap-4 rounded-xl border border-border bg-surface p-3 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lift md:gap-6 md:p-4"
          >
            <div className="flex w-16 flex-col items-center rounded-lg bg-surface-2 py-2 md:w-20">
              <span className="font-serif text-3xl leading-none tabular-nums">{formatDay(r.checkIn, locale, { day: 'numeric' })}</span>
              <span className="mt-1 text-[10px] tracking-wider text-muted uppercase">{formatDay(r.checkIn, locale, { month: 'short' })}</span>
            </div>
            <div className="min-w-0">
              <p className="flex items-center gap-2 truncate font-medium">
                {r.isVip && <Crown className="size-3.5 shrink-0 text-gold-500" />}
                {r.firstName} {r.lastName}
              </p>
              <p className="mt-1 truncate text-xs text-muted">
                {r.code} · {t.nights(r.nights)} · {localized(r.typeName, locale)} ·{' '}
                {r.roomNumber ? `${t.room} ${r.roomNumber}` : <span className="text-accent">{t.unassigned}</span>}
                {r.eta ? ` · ${r.eta}` : ''}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span className={cn('rounded-full px-2.5 py-1 text-[11px]', STATUS_TONE[r.status])}>{t.status[r.status]}</span>
              <span className={cn('text-xs tabular-nums', r.balance > 0.009 ? 'text-accent' : 'text-subtle')}>
                {r.balance > 0.009 ? money(r.balance) : t.settled}
              </span>
            </div>
          </button>
        ))}
      </div>

      <NewBookingSheet
        open={creating}
        onOpenChange={setCreating}
        form={form}
        today={today}
        locale={locale}
        t={t}
        money={money}
        manager={manager}
        onCreated={(id) => {
          setCreating(false);
          router.push(href({ view: 'all', b: id }), { scroll: false });
        }}
      />

      <Sheet open={Boolean(detail)} onOpenChange={(o) => !o && router.replace(href({ b: null }), { scroll: false })}>
        <SheetContent closeLabel={t.close} className="max-w-xl overflow-y-auto">
          {detail && (
            <DetailBody
              key={detail.id}
              d={detail}
              form={form}
              t={t}
              locale={locale}
              money={money}
              manager={manager}
              today={today}
              guestHref={`${pathname.replace(/\/bookings$/, '/guests')}/${detail.guestId}`}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ───────────────────────── New booking ───────────────────────── */

function NewBookingSheet({
  open, onOpenChange, form, today, locale, t, money, manager, onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  form: BookingFormData;
  today: string;
  locale: string;
  t: BookingCopy;
  money: (n: number) => string;
  manager: boolean;
  onCreated: (id: string) => void;
}) {
  const init = {
    roomTypeId: form.roomTypes[0]?.id ?? '',
    checkIn: today,
    checkOut: addDays(today, 1),
    adults: 2,
    children: 0,
    source: 'direct',
    status: 'confirmed',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    nationality: '',
    eta: '',
    specialRequests: '',
    priceOverride: '',
    autoAssign: true,
  };
  const [s, setS] = useState(init);
  const set = <K extends keyof typeof init>(k: K, v: (typeof init)[K]) => setS((p) => ({ ...p, [k]: v }));
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const seq = useRef(0);
  const act = useAction(t);

  useEffect(() => {
    if (!open || !s.roomTypeId || s.checkOut <= s.checkIn) return;
    const id = ++seq.current;
    setQuoting(true);
    const timer = setTimeout(async () => {
      const res = await getStayQuote({ roomTypeId: s.roomTypeId, checkIn: s.checkIn, checkOut: s.checkOut, guests: s.adults + s.children });
      if (id !== seq.current) return;
      setQuoting(false);
      setQuote(res.ok ? res.data : null);
    }, 300);
    return () => clearTimeout(timer);
  }, [open, s.roomTypeId, s.checkIn, s.checkOut, s.adults, s.children]);

  const peak = quote?.ok ? Math.max(...quote.nightly.map((n) => n.price)) : 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    act.run(
      () =>
        createBooking({
          roomTypeId: s.roomTypeId,
          checkIn: s.checkIn,
          checkOut: s.checkOut,
          adults: s.adults,
          children: s.children,
          source: s.source,
          status: s.status,
          autoAssign: s.autoAssign,
          priceOverride: s.priceOverride === '' ? undefined : Number(s.priceOverride),
          eta: s.eta || undefined,
          specialRequests: s.specialRequests || undefined,
          guest: {
            firstName: s.firstName,
            lastName: s.lastName,
            email: s.email || undefined,
            phone: s.phone || undefined,
            nationality: s.nationality || undefined,
          },
        }),
      (data) => {
        setS(init);
        setQuote(null);
        onCreated(data.id);
      },
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent closeLabel={t.close} className="max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t.form.title}</SheetTitle>
        </SheetHeader>
        <form onSubmit={submit} className="space-y-8 p-6">
          <fieldset className="space-y-4">
            <legend className="mb-3 font-serif text-2xl">{t.form.stay}</legend>
            <div>
              <label className={label}>{t.form.roomType}</label>
              <select className={input} value={s.roomTypeId} onChange={(e) => set('roomTypeId', e.target.value)}>
                {form.roomTypes.map((rt) => (
                  <option key={rt.id} value={rt.id}>{localized(rt.name, locale)} · max {rt.maxOccupancy}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>{t.form.checkIn}</label>
                <input type="date" className={input} min={today} value={s.checkIn} required
                  onChange={(e) => {
                    const v = e.target.value;
                    setS((p) => ({ ...p, checkIn: v, checkOut: p.checkOut <= v ? addDays(v, 1) : p.checkOut }));
                  }} />
              </div>
              <div>
                <label className={label}>{t.form.checkOut}</label>
                <input type="date" className={input} min={addDays(s.checkIn, 1)} value={s.checkOut} required onChange={(e) => set('checkOut', e.target.value)} />
              </div>
              <div>
                <label className={label}>{t.form.adults}</label>
                <input type="number" min={1} max={12} className={input} value={s.adults} onChange={(e) => set('adults', Number(e.target.value))} />
              </div>
              <div>
                <label className={label}>{t.form.children}</label>
                <input type="number" min={0} max={12} className={input} value={s.children} onChange={(e) => set('children', Number(e.target.value))} />
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-border bg-surface-2/60 p-5">
              {quoting && <p className="text-xs text-muted">{t.form.quoting}</p>}
              {!quoting && quote?.ok && (
                <>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="font-serif text-4xl tabular-nums">{money(quote.total)}</p>
                      <p className="mt-1 text-xs text-muted">
                        {t.nights(quote.nights)} · {money(quote.total / quote.nights)} {t.form.perNight}
                      </p>
                    </div>
                    <span className={cn('rounded-full px-3 py-1 text-xs', quote.available <= 2 ? 'bg-accent-soft text-accent' : 'bg-olive-100 text-olive-700 dark:bg-olive-700/30 dark:text-olive-100')}>
                      {t.form.left(quote.available)}
                    </span>
                  </div>
                  <div className="mt-4 flex h-12 items-end gap-1" aria-hidden>
                    {quote.nightly.map((n) => (
                      <div key={n.date} title={`${n.date} · ${money(n.price)}`}
                        className="flex-1 rounded-t bg-ionian-500/60 transition-all hover:bg-ionian-500"
                        style={{ height: `${Math.max(18, (n.price / (peak || 1)) * 100)}%` }} />
                    ))}
                  </div>
                </>
              )}
              {!quoting && quote && !quote.ok && <p className="text-sm text-danger">{t.errors[quote.reason]}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>{t.form.source}</label>
                <select className={input} value={s.source} onChange={(e) => set('source', e.target.value)}>
                  {Object.entries(t.source).filter(([k]) => k !== 'ai_voice').map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className={label}>{t.form.status}</label>
                <select className={input} value={s.status} onChange={(e) => set('status', e.target.value)}>
                  <option value="confirmed">{t.status.confirmed}</option>
                  <option value="tentative">{t.status.tentative}</option>
                </select>
              </div>
            </div>
            {manager && (
              <div>
                <label className={label}>{t.form.price}</label>
                <input type="number" min={0} step="0.01" className={input} value={s.priceOverride} onChange={(e) => set('priceOverride', e.target.value)} />
              </div>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={s.autoAssign} onChange={(e) => set('autoAssign', e.target.checked)} />
              {t.form.autoAssign}
            </label>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="mb-3 font-serif text-2xl">{t.form.guest}</legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>{t.form.firstName}</label>
                <input required maxLength={80} className={input} value={s.firstName} onChange={(e) => set('firstName', e.target.value)} />
              </div>
              <div>
                <label className={label}>{t.form.lastName}</label>
                <input required maxLength={80} className={input} value={s.lastName} onChange={(e) => set('lastName', e.target.value)} />
              </div>
              <div>
                <label className={label}>{t.form.email}</label>
                <input type="email" maxLength={160} className={input} value={s.email} onChange={(e) => set('email', e.target.value)} />
              </div>
              <div>
                <label className={label}>{t.form.phone}</label>
                <input type="tel" maxLength={40} className={input} value={s.phone} onChange={(e) => set('phone', e.target.value)} />
              </div>
              <div>
                <label className={label}>{t.form.nationality}</label>
                <input maxLength={56} className={input} value={s.nationality} onChange={(e) => set('nationality', e.target.value)} />
              </div>
              <div>
                <label className={label}>{t.form.eta}</label>
                <input type="time" className={input} value={s.eta} onChange={(e) => set('eta', e.target.value)} />
              </div>
            </div>
            <div>
              <label className={label}>{t.form.requests}</label>
              <textarea maxLength={1000} className={cn(input, 'h-20 py-2')} value={s.specialRequests} onChange={(e) => set('specialRequests', e.target.value)} />
            </div>
            <p className="text-xs text-subtle">{t.form.dedupe}</p>
          </fieldset>

          {act.message && <p role="alert" className="rounded-md bg-danger-soft p-3 text-sm text-danger">{act.message}</p>}
          <button
            disabled={act.pending || !quote?.ok}
            className="h-12 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground transition-opacity disabled:opacity-40"
          >
            {t.form.create}
          </button>
        </form>
      </SheetContent>
    </Sheet>
  );
}

/* ───────────────────────── Detail ───────────────────────── */

function DetailBody({
  d, form, t, locale, money, manager, today, guestHref,
}: {
  d: BookingDetail;
  form: BookingFormData;
  t: BookingCopy;
  locale: string;
  money: (n: number) => string;
  manager: boolean;
  today: string;
  guestHref: string;
}) {
  const act = useAction(t);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const long = (x: string) => formatDay(x, locale, { weekday: 'short', day: 'numeric', month: 'short' });
  const stamp = (iso: string) =>
    new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'sq-AL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  const phoneDigits = d.phone?.replace(/[^\d]/g, '');
  const canAssign = ['tentative', 'confirmed', 'checked_in'].includes(d.status);
  const roomOptions = form.rooms.filter((r) => r.status !== 'out_of_order' && (manager || r.roomTypeId === d.roomTypeId));

  return (
    <>
      <SheetHeader>
        <div className="flex items-center gap-2">
          <span className={cn('rounded-full px-2.5 py-1 text-[11px]', STATUS_TONE[d.status])}>{t.status[d.status]}</span>
          <span className="text-xs text-muted">{d.code} · {t.source[d.source]}</span>
        </div>
        <SheetTitle className="flex items-center gap-2">
          {d.isVip && <Crown className="size-5 text-gold-500" />}
          {d.firstName} {d.lastName}
        </SheetTitle>
        <div className="mt-2 flex flex-wrap gap-2">
          {phoneDigits && (
            <>
              <a href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs hover:bg-surface-2">
                <MessageCircle className="size-3.5" /> {t.actions.whatsapp}
              </a>
              <a href={`tel:${d.phone}`} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs hover:bg-surface-2">
                <Phone className="size-3.5" /> {t.actions.call}
              </a>
            </>
          )}
          <Link href={guestHref} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border px-3 text-xs hover:bg-surface-2">
            {t.profile} <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      </SheetHeader>

      <div className="space-y-8 p-6">
        <section className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl bg-ionian-950 p-5 text-limestone-50">
          <div>
            <p className="text-[10px] tracking-widest text-ionian-200 uppercase">{t.form.checkIn}</p>
            <p className="mt-1 font-serif text-2xl">{long(d.checkIn)}</p>
          </div>
          <span className="rounded-full border border-white/20 px-3 py-1 text-xs">{t.nights(d.nights)}</span>
          <div className="text-right">
            <p className="text-[10px] tracking-widest text-ionian-200 uppercase">{t.form.checkOut}</p>
            <p className="mt-1 font-serif text-2xl">{long(d.checkOut)}</p>
          </div>
          <p className="col-span-3 border-t border-white/15 pt-3 text-xs text-ionian-200">
            {localized(d.typeName, locale)} · {d.roomNumber ? `${t.room} ${d.roomNumber}` : t.unassigned} · {t.people(d.adults, d.children)}
            {d.eta ? ` · ETA ${d.eta}` : ''}
          </p>
        </section>

        {(d.specialRequests || d.guestNotes) && (
          <div className="rounded-lg border border-gold-400/50 bg-accent-soft p-4 text-sm">
            {d.specialRequests && <p>{d.specialRequests}</p>}
            {d.guestNotes && <p className="mt-2 text-xs text-muted">{d.guestNotes}</p>}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {d.status === 'tentative' && (
            <button disabled={act.pending} onClick={() => act.run(() => confirmBooking(d.id))} className="h-11 flex-1 rounded-md bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50">
              {t.actions.confirm}
            </button>
          )}
          {d.status === 'confirmed' && d.checkIn <= today && (
            <button disabled={act.pending} onClick={() => act.run(() => checkInBooking(d.id))} className="h-11 flex-1 rounded-md bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50">
              {t.actions.checkIn}
            </button>
          )}
          {d.status === 'checked_in' && (
            <button disabled={act.pending} onClick={() => act.run(() => checkOutBooking({ bookingId: d.id }))} className="h-11 flex-1 rounded-md bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50">
              {t.actions.checkOut}
            </button>
          )}
          {act.error === 'balanceDue' && manager && (
            <button disabled={act.pending} onClick={() => act.run(() => checkOutBooking({ bookingId: d.id, force: true }))} className="h-11 rounded-md border border-danger px-4 text-sm text-danger">
              {t.actions.forceCheckOut}
            </button>
          )}
          {['tentative', 'confirmed'].includes(d.status) && (
            <button onClick={() => setCancelling((v) => !v)} className="h-11 rounded-md border border-border px-4 text-sm hover:bg-surface-2">
              {t.actions.cancel}
            </button>
          )}
          {d.status === 'confirmed' && d.checkIn <= today && (
            <button disabled={act.pending} onClick={() => act.run(() => markNoShow(d.id))} className="h-11 rounded-md border border-border px-4 text-sm hover:bg-surface-2">
              {t.actions.noShow}
            </button>
          )}
        </div>

        {cancelling && (
          <div className="flex gap-2">
            <input className={input} placeholder={t.actions.reason} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
            <button disabled={act.pending || reason.trim().length < 3} onClick={() => act.run(() => cancelBooking({ bookingId: d.id, reason }), () => setCancelling(false))}
              className="shrink-0 rounded-md bg-danger px-4 text-sm text-white disabled:opacity-40">
              {t.actions.confirmCancel}
            </button>
          </div>
        )}

        {act.message && <p role="alert" className="rounded-md bg-danger-soft p-3 text-sm text-danger">{act.message}</p>}

        {canAssign && (
          <section>
            <label className={label}>{t.actions.assign}</label>
            <select
              className={input}
              value={d.roomId ?? ''}
              disabled={act.pending}
              onChange={(e) => act.run(() => assignRoom({ bookingId: d.id, roomId: e.target.value || null }))}
            >
              {d.status !== 'checked_in' && <option value="">{t.unassigned}</option>}
              {roomOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.number}
                  {r.roomTypeId !== d.roomTypeId ? ' ↑' : ''} · {r.status}
                </option>
              ))}
            </select>
          </section>
        )}

        <section>
          <h3 className="mb-3 font-serif text-2xl">{t.sections.money}</h3>
          <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-border bg-border text-sm">
            {[[t.total, d.total], [t.extras, d.extras], [t.paid, d.paid]].map(([k, v]) => (
              <div key={k as string} className="bg-surface p-4">
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="mt-1 tabular-nums">{money(v as number)}</dd>
              </div>
            ))}
          </dl>
          <div className={cn('mt-3 flex items-baseline justify-between rounded-xl p-4', d.balance > 0.009 ? 'bg-accent-soft' : 'bg-olive-100 dark:bg-olive-700/25')}>
            <span className="text-sm">{d.balance > 0.009 ? t.balance : t.settled}</span>
            <span className="font-serif text-3xl tabular-nums">{money(Math.max(0, d.balance))}</span>
          </div>

          <form
            className="mt-4 grid grid-cols-2 gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const el = e.currentTarget;
              const f = new FormData(el);
              act.run(
                () => recordPayment({ bookingId: d.id, amount: f.get('amount'), method: f.get('method'), refund: f.get('refund') === 'on', reference: f.get('reference') || undefined }),
                () => el.reset(),
              );
            }}
          >
            <input name="amount" type="number" step="0.01" min="0.01" required placeholder={t.pay.amount}
              defaultValue={d.balance > 0.009 ? d.balance.toFixed(2) : ''} className={input} />
            <select name="method" className={input} defaultValue="cash">
              {(['cash', 'card', 'bank_transfer', 'online'] as const).map((m) => <option key={m} value={m}>{t.pay.methods[m]}</option>)}
            </select>
            <input name="reference" maxLength={120} placeholder={t.pay.reference} className={cn(input, 'col-span-2')} />
            {manager && (
              <label className="flex items-center gap-2 text-xs text-muted">
                <input type="checkbox" name="refund" /> {t.pay.refund}
              </label>
            )}
            <button disabled={act.pending} className={cn('h-10 rounded-md border border-border-strong text-sm hover:bg-surface-2 disabled:opacity-50', !manager && 'col-span-2')}>
              {t.pay.submit}
            </button>
          </form>
        </section>

        {d.status === 'checked_in' && (
          <section>
            <h3 className="mb-3 font-serif text-2xl">{t.charge.title}</h3>
            <form
              className="grid grid-cols-6 gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const el = e.currentTarget;
                const f = new FormData(el);
                act.run(
                  () => postCharge({ bookingId: d.id, type: f.get('type'), description: f.get('description'), quantity: f.get('quantity'), unitPrice: f.get('unitPrice') }),
                  () => el.reset(),
                );
              }}
            >
              <select name="type" className={cn(input, 'col-span-3')}>
                {(['restaurant', 'bar', 'pool_bar', 'room_service', 'spa', 'minibar', 'service'] as const).map((k) => (
                  <option key={k} value={k}>{t.charge.types[k]}</option>
                ))}
                {manager && <option value="discount">{t.charge.types.discount}</option>}
              </select>
              <input name="description" required minLength={2} maxLength={160} placeholder={t.charge.description} className={cn(input, 'col-span-3')} />
              <input name="quantity" type="number" step="0.001" min="0.001" defaultValue={1} className={cn(input, 'col-span-2')} aria-label={t.charge.qty} />
              <input name="unitPrice" type="number" step="0.01" min="0" required placeholder={t.charge.price} className={cn(input, 'col-span-2')} />
              <button disabled={act.pending} className="col-span-2 h-10 rounded-md bg-primary text-sm text-primary-foreground disabled:opacity-50">
                {t.charge.submit}
              </button>
            </form>
          </section>
        )}

        {d.items.length > 0 && (
          <section>
            <h3 className="mb-3 font-serif text-2xl">{t.sections.folio}</h3>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {d.items.map((i) => (
                <li key={i.id} className={cn('flex items-center gap-3 px-4 py-3 text-sm', (i.voided || i.reversal) && 'text-subtle')}>
                  <span className="min-w-0 flex-1 truncate">
                    <span className={cn(i.voided && 'line-through')}>{i.description}</span>
                    <span className="ml-2 text-xs text-muted">{t.charge.types[i.type]} · {i.quantity}×</span>
                  </span>
                  <span className="tabular-nums">{money(i.amount)}</span>
                  {manager && !i.voided && !i.reversal && d.status === 'checked_in' && (
                    <button onClick={() => act.run(() => voidCharge(i.id))} className="text-xs text-danger hover:underline">{t.charge.void}</button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {d.payments.length > 0 && (
          <section>
            <h3 className="mb-3 font-serif text-2xl">{t.sections.payments}</h3>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {d.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span>
                    {t.pay.methods[p.method]}
                    <span className="ml-2 text-xs text-muted">{stamp(p.receivedAt)}{p.reference ? ` · ${p.reference}` : ''}</span>
                  </span>
                  <span className={cn('tabular-nums', p.isRefund && 'text-danger')}>{p.isRefund ? '−' : ''}{money(p.amount)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h3 className="mb-4 font-serif text-2xl">{t.sections.timeline}</h3>
          <ol className="relative space-y-4 border-l border-border pl-5">
            {d.timeline.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-surface bg-ionian-500" />
                <p className="text-sm">{t.timeline[e.action] ?? e.action}</p>
                <p className="text-xs text-muted">{stamp(e.createdAt)}{e.who ? ` · ${e.who}` : ''}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
