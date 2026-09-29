'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle, ArrowLeft, ArrowUpRight, BedDouble, CalendarClock, Cake, Check, Copy, CreditCard, Crown, Download, FileText, Flower2, GitMerge, Heart, Mail, MessageCircle,
  NotebookPen, Pencil, Phone, Pin, PinOff, Plus, Receipt, ShieldCheck, Sparkles, Star, Trash2, UserRound, X,
} from 'lucide-react';
import { CountUp } from '@/components/app/dashboard/count-up';
import { useAction } from '@/components/app/use-action';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Label } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SOURCE_COLOR, type BookingSource } from '@/config/channels';
import { Link } from '@/i18n/navigation';
import { formatDay, relativeTime } from '@/lib/dates';
import { formatCurrency, type Currency } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  addGuestNote, aiGuestBrief, aiGuestMessage, anonymizeGuest, deleteGuestNote, mergeGuests, saveGuestPreferences, setGuestFlags, setNotePinned, updateGuestDetails,
} from '@/server/actions/guest-profile';
import type { GuestPreferences, GuestProfile as Profile, TimelineItem } from '@/server/queries/guest-profile';
import { pickCopy as pickBookingCopy } from '../bookings/copy';
import { pickProfileCopy, type ProfileCopy } from './profile-copy';

const TIER: Record<string, { ring: string; glow: string; pill: string }> = {
  platinum: { ring: 'from-slate-200 via-ionian-300 to-slate-100', glow: 'bg-ionian-300/30', pill: 'bg-gradient-to-r from-slate-200 to-ionian-200 text-ionian-950' },
  gold: { ring: 'from-gold-400 via-gold-100 to-gold-500', glow: 'bg-gold-400/30', pill: 'bg-gradient-to-r from-gold-400 to-gold-100 text-ionian-950' },
  silver: { ring: 'from-limestone-300 via-white to-limestone-400', glow: 'bg-limestone-300/25', pill: 'bg-gradient-to-r from-limestone-200 to-white text-ionian-950' },
  bronze: { ring: 'from-terracotta-400 via-gold-100 to-terracotta-500', glow: 'bg-terracotta-400/25', pill: 'bg-gradient-to-r from-terracotta-400 to-gold-100 text-ionian-950' },
  new: { ring: 'from-ionian-400 via-ionian-200 to-ionian-500', glow: 'bg-ionian-400/25', pill: 'bg-white/15 text-limestone-50' },
};
const KIND_ICON: Record<TimelineItem['kind'], typeof BedDouble> = { booking: CalendarClock, stay: BedDouble, charge: Receipt, payment: CreditCard, spa: Flower2, message: MessageCircle, call: Phone, invoice: FileText, note: NotebookPen, profile: UserRound };
const KIND_TONE: Record<TimelineItem['kind'], string> = { booking: 'bg-ionian-100 text-ionian-700 dark:bg-ionian-900 dark:text-ionian-200', stay: 'bg-olive-100 text-olive-700 dark:bg-olive-700/30 dark:text-olive-100', charge: 'bg-gold-100 text-gold-500 dark:bg-gold-400/15 dark:text-gold-400', payment: 'bg-success-soft text-success', spa: 'bg-terracotta-100 text-terracotta-700 dark:bg-terracotta-400/15 dark:text-terracotta-400', message: 'bg-[#2fa36b]/15 text-[#2fa36b]', call: 'bg-[#8a6fd1]/15 text-[#8a6fd1]', invoice: 'bg-surface-3 text-muted', note: 'bg-accent-soft text-accent', profile: 'bg-surface-3 text-muted' };
const FILTERS: Record<string, TimelineItem['kind'][] | null> = { all: null, bookings: ['booking', 'stay'], money: ['charge', 'payment', 'invoice'], spa: ['spa'], messages: ['message', 'call'], notes: ['note', 'profile'] };
const TABS = ['activity', 'stays', 'spend', 'preferences', 'messages', 'notes', 'privacy'] as const;
type Tab = (typeof TABS)[number];
const PREF_CATS = ['room', 'pillow', 'dietary', 'allergies', 'interests', 'transport'] as const;

const fade = { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const } };

export function GuestProfileView({ data, locale, currency, canManage }: { data: Profile; locale: string; currency: Currency; canManage: boolean }) {
  const t = pickProfileCopy(locale);
  const router = useRouter();
  const act = useAction(t.errors);
  const [tab, setTab] = useState<Tab>('activity');
  const [editing, setEditing] = useState(false);
  const [composePurpose, setComposePurpose] = useState<string | null>(null);
  const g = data.guest;
  const s = data.stats;
  const name = `${g.firstName} ${g.lastName}`;
  const money = (n: number) => formatCurrency(n, currency, locale, 0);
  const tier = TIER[s.tier] ?? TIER.new!;
  const phoneDigits = (g.phone ?? '').replace(/\D/g, '');
  const allergies = g.preferences.allergies ?? [];

  const refresh = () => router.refresh();

  return (
    <div className="mx-auto max-w-7xl">
      <Link href="/app/guests" className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-foreground"><ArrowLeft className="size-4" /> {t.back}</Link>

      {/* ───── Cover ───── */}
      <motion.section {...fade} className="relative mt-5 overflow-hidden rounded-[2rem] bg-ionian-950 text-limestone-50">
        <motion.div className={cn('pointer-events-none absolute -top-40 -left-24 size-[34rem] rounded-full blur-[120px]', tier.glow)} animate={{ x: [0, 60, 0], y: [0, 30, 0] }} transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }} />
        <motion.div className="pointer-events-none absolute -right-32 -bottom-48 size-[30rem] rounded-full bg-ionian-500/25 blur-[120px]" animate={{ x: [0, -40, 0] }} transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }} />
        <div className="bg-qilim pointer-events-none absolute inset-0 opacity-30 [mask-image:linear-gradient(to_left,black,transparent_70%)]" />

        <div className="relative flex flex-col gap-7 px-7 pt-10 pb-8 md:px-12 md:pt-14">
          <div className="flex min-w-0 flex-col gap-6 sm:flex-row sm:items-end">
            <div className="relative size-32 shrink-0">
              <motion.div className={cn('absolute inset-0 rounded-full bg-gradient-to-tr p-[3px]', tier.ring)} animate={{ rotate: 360 }} transition={{ duration: 12, repeat: Infinity, ease: 'linear' }} />
              <div className="absolute inset-[4px] grid place-items-center rounded-full bg-ionian-900 font-display text-5xl">{g.firstName.slice(0, 1)}{g.lastName.slice(0, 1)}</div>
              {g.nationality && /^[A-Z]{2}$/.test(g.nationality) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`https://flagcdn.com/w80/${g.nationality.toLowerCase()}.png`} alt={g.nationality} title={g.nationality} className="absolute -right-1 -bottom-1 size-10 rounded-full object-cover ring-4 ring-ionian-950" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn('text-shimmer rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.2em] uppercase', tier.pill)} style={{ WebkitTextFillColor: 'currentColor' }}>{t.tier[s.tier]}</span>
                {g.isVip && <span className="inline-flex items-center gap-1 rounded-full bg-gold-400 px-3 py-1 text-[11px] font-semibold text-ionian-950"><Crown className="size-3.5" /> VIP</span>}
              </div>
              <h1 className="font-display mt-3 text-5xl leading-none md:text-6xl xl:text-7xl">{name}</h1>
              <p className="mt-3 text-sm text-ionian-200">{t.memberSince(formatDay(g.createdAt.slice(0, 10), locale, { month: 'long', year: 'numeric' }))}{g.language ? ` · ${g.language.toUpperCase()}` : ''}{g.city ? ` · ${g.city}` : ''}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {s.segments.map((seg, i) => (
                  <motion.span key={seg} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 + i * 0.06 }} className={cn('rounded-full border px-3 py-1 text-xs', seg === 'at_risk' ? 'border-terracotta-400/60 bg-terracotta-500/20 text-terracotta-100' : 'border-white/15 bg-white/5 text-ionian-100')}>{t.segment[seg]}</motion.span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href={`/app/assistant?q=${encodeURIComponent(t.bookPrompt(name, g.id))}`} className="inline-flex h-11 items-center gap-2 rounded-full bg-gold-400 px-5 text-sm font-semibold text-ionian-950 transition-transform hover:-translate-y-0.5"><Plus className="size-4" /> {t.actions.book}</Link>
            {phoneDigits && <a href={`https://wa.me/${phoneDigits}`} target="_blank" rel="noreferrer" className="grid size-11 place-items-center rounded-full bg-[#2fa36b] text-white transition-transform hover:-translate-y-0.5" title={t.actions.whatsapp}><MessageCircle className="size-4" /></a>}
            {g.phone && <a href={`tel:${g.phone}`} className="grid size-11 place-items-center rounded-full border border-white/20 transition-colors hover:bg-white/10" title={t.actions.call}><Phone className="size-4" /></a>}
            {g.email && <a href={`mailto:${g.email}`} className="grid size-11 place-items-center rounded-full border border-white/20 transition-colors hover:bg-white/10" title={t.actions.email}><Mail className="size-4" /></a>}
            <button type="button" disabled={act.pending} onClick={() => act.run(() => setGuestFlags({ guestId: g.id, isVip: !g.isVip }), refresh)} className={cn('grid size-11 place-items-center rounded-full border transition-colors', g.isVip ? 'border-gold-400 bg-gold-400/20 text-gold-400' : 'border-white/20 hover:bg-white/10')} title={g.isVip ? t.actions.vipOff : t.actions.vipOn}><Star className={cn('size-4', g.isVip && 'fill-current')} /></button>
            <button type="button" onClick={() => setEditing(true)} className="grid size-11 place-items-center rounded-full border border-white/20 transition-colors hover:bg-white/10" title={t.actions.edit}><Pencil className="size-4" /></button>
          </div>
        </div>

        {/* stats */}
        <div className="relative grid grid-cols-2 gap-px border-t border-white/10 bg-white/10 sm:grid-cols-3 2xl:grid-cols-6">
          {[
            { k: 'stays', v: <CountUp value={s.stays} locale={locale} /> },
            { k: 'nights', v: <CountUp value={s.nights} locale={locale} /> },
            { k: 'lifetime', v: <CountUp value={s.lifetime} locale={locale} kind="currency" currency={currency} /> },
            { k: 'avgNight', v: <CountUp value={s.avgNightly} locale={locale} kind="currency" currency={currency} /> },
            { k: 'extras', v: <CountUp value={s.extras} locale={locale} kind="currency" currency={currency} /> },
          ].map((x) => (
            <div key={x.k} className="bg-ionian-950/80 px-6 py-5">
              <p className="text-[11px] tracking-wider text-ionian-200 uppercase">{t.stats[x.k as keyof ProfileCopy['stats']]}</p>
              <p className="font-serif mt-1 text-3xl tabular-nums md:text-4xl">{x.v}</p>
            </div>
          ))}
          <div className="flex min-w-0 items-center gap-3 bg-ionian-950/80 px-5 py-5">
            <ScoreRing value={s.score} />
            <p className="min-w-0 text-[11px] leading-snug tracking-wider text-ionian-200 uppercase">{t.stats.score}</p>
          </div>
        </div>
      </motion.section>

      {/* ───── Smart banners ───── */}
      <div className="mt-5 grid gap-3 md:grid-cols-[repeat(auto-fit,minmax(24rem,1fr))]">
        {allergies.length > 0 && (
          <Banner tone="danger" icon={AlertTriangle}><b>{t.banners.allergies}:</b> {allergies.join(', ')}</Banner>
        )}
        {data.inHouse && (
          <Banner tone="good" icon={BedDouble} action={<Link href={`/app/bookings?view=all&b=${data.inHouse.id}`} className="text-xs font-medium underline">{t.banners.openBooking}</Link>}>
            {t.banners.inHouse(data.inHouse.room ?? '', formatDay(data.inHouse.checkOut, locale, { weekday: 'long', day: 'numeric', month: 'short' }))}
            {data.inHouse.balance > 0.01 && <span className="ml-2 font-medium text-danger">{t.banners.balance(money(data.inHouse.balance))}</span>}
          </Banner>
        )}
        {!data.inHouse && data.next && (
          <Banner tone="info" icon={CalendarClock} action={<button type="button" onClick={() => { setComposePurpose('pre_arrival'); document.getElementById('compose')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} className="text-xs font-medium underline">{t.banners.prepare}</button>}>
            <Countdown days={data.next.inDays} /> {t.banners.next(data.next.inDays, data.next.type)}
          </Banner>
        )}
        {data.birthday && data.birthday.inDays <= 30 && (
          <Banner tone="gold" icon={Cake} action={<button type="button" onClick={() => { setComposePurpose('birthday'); document.getElementById('compose')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} className="text-xs font-medium underline">{t.banners.winBack}</button>}>
            {t.banners.birthday(data.birthday.inDays, data.birthday.age)}
          </Banner>
        )}
        {s.segments.includes('at_risk') && s.daysSince !== null && (
          <Banner tone="danger" icon={Heart} action={<button type="button" onClick={() => { setComposePurpose('win_back'); document.getElementById('compose')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }} className="text-xs font-medium underline">{t.banners.winBack}</button>}>
            {t.banners.atRisk(s.daysSince)}
          </Banner>
        )}
      </div>

      {/* ───── Main grid ───── */}
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="min-w-0">
          <nav className="no-scrollbar flex gap-0.5 overflow-x-auto border-b border-border">
            {TABS.map((k) => (
              <button key={k} type="button" onClick={() => setTab(k)} className={cn('relative shrink-0 px-3 py-3 text-sm transition-colors', tab === k ? 'text-foreground' : 'text-muted hover:text-foreground')}>
                {t.tabs[k]}
                {k === 'notes' && data.notes.length > 0 && <span className="ml-1.5 rounded-full bg-accent-soft px-1.5 text-[10px] text-accent">{data.notes.length}</span>}
                {k === 'stays' && <span className="ml-1.5 text-[10px] text-subtle">{data.stayList.length}</span>}
                {tab === k && <motion.span layoutId="guest-tab" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
              </button>
            ))}
          </nav>
          <AnimatePresence mode="wait">
            <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }} className="pt-7">
              {tab === 'activity' && <Activity data={data} t={t} locale={locale} money={money} />}
              {tab === 'stays' && <Stays data={data} t={t} locale={locale} money={money} />}
              {tab === 'spend' && <Spend data={data} t={t} money={money} />}
              {tab === 'preferences' && <Preferences key={JSON.stringify(g.preferences)} guestId={g.id} prefs={g.preferences} t={t} onSaved={refresh} />}
              {tab === 'messages' && <Messages data={data} t={t} locale={locale} />}
              {tab === 'notes' && <Notes data={data} t={t} locale={locale} canManage={canManage} onDone={refresh} />}
              {tab === 'privacy' && <Privacy data={data} t={t} locale={locale} canManage={canManage} onDone={refresh} />}
            </motion.div>
          </AnimatePresence>
        </div>

        <aside className="space-y-5">
          <BriefCard guestId={g.id} t={t} locale={locale} />
          <ComposeCard guestId={g.id} t={t} locale={locale} phone={phoneDigits} email={g.email} purpose={composePurpose} setPurpose={setComposePurpose} />
          <Completeness value={s.completeness} missing={s.missing} t={t} onEdit={() => setEditing(true)} />
          <Duplicates data={data} t={t} onDone={refresh} />
          <Tags guestId={g.id} tags={g.tags} t={t} onDone={refresh} />
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
            <p className="text-xs tracking-wider text-muted uppercase">{t.side.facts}</p>
            <dl className="mt-3 space-y-2.5 text-sm">
              {[
                [t.stays.favRoom, s.favRoom ?? '—'], [t.stays.favType, s.favType ?? '—'], [t.stays.channel, s.channel ? pickBookingCopy(locale).source[s.channel] ?? s.channel : '—'],
                [t.stays.lead, s.avgLead !== null ? t.stays.leadDays(s.avgLead) : '—'], [t.stays.avgNights, s.avgNights ? t.stays.nights(Math.round(s.avgNights)) : '—'],
                [t.side.bookings, String(s.bookings)], [t.side.cancellations, String(s.cancelled)], [t.side.noShows, String(s.noShows)],
              ].map(([k, v]) => <div key={k} className="flex justify-between gap-3"><dt className="text-muted">{k}</dt><dd className="text-right font-medium">{v}</dd></div>)}
            </dl>
          </div>
        </aside>
      </div>

      {act.message && <p className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-danger px-5 py-2.5 text-sm text-white shadow-float">{act.message}</p>}
      {editing && <EditDialog data={data} t={t} onClose={() => setEditing(false)} onDone={() => { setEditing(false); refresh(); }} />}
    </div>
  );
}

/* ───────────── small pieces ───────────── */

function ScoreRing({ value }: { value: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const color = value >= 70 ? 'var(--color-olive-400)' : value >= 40 ? 'var(--color-gold-400)' : 'var(--color-terracotta-400)';
  return (
    <div className="relative size-14 shrink-0">
      <svg viewBox="0 0 56 56" className="size-full -rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="5" />
        <motion.circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - value / 100) }} transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }} />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-serif text-lg tabular-nums">{value}</span>
    </div>
  );
}

function Countdown({ days }: { days: number }) {
  return <span className="mr-1 inline-grid min-w-8 place-items-center rounded-md bg-ionian-900 px-1.5 py-0.5 font-serif text-lg leading-none text-limestone-50 tabular-nums">{days}</span>;
}

function Banner({ tone, icon: Icon, children, action }: { tone: 'danger' | 'good' | 'info' | 'gold'; icon: typeof BedDouble; children: React.ReactNode; action?: React.ReactNode }) {
  const cls = { danger: 'border-danger/30 bg-danger-soft text-danger', good: 'border-success/30 bg-success-soft text-success', info: 'border-ionian-300/40 bg-ionian-50 text-ionian-800 dark:bg-ionian-900/50 dark:text-ionian-100', gold: 'border-gold-400/40 bg-gold-100 text-limestone-900 dark:bg-gold-400/15 dark:text-gold-400' }[tone];
  return (
    <motion.div {...fade} className={cn('flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-sm', cls)}>
      <Icon className="size-5 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </motion.div>
  );
}

function describe(item: TimelineItem, t: ProfileCopy, locale: string): { title: string; sub?: string } {
  const p = item.title.split('|');
  const b = pickBookingCopy(locale);
  const ch = (c: string) => ({ whatsapp: 'WhatsApp', instagram: 'Instagram', messenger: 'Messenger', web_chat: 'Chat', email: 'Email', voice: 'Telefon' })[c] ?? c;
  switch (item.kind) {
    case 'booking': {
      if (p[0] === 'booking.cancelled') return { title: t.tl.cancelled(p[1] ?? ''), sub: item.detail };
      const [ci, co, src] = (item.detail ?? '').split('|');
      return { title: t.tl.created(p[2] ?? ''), sub: `${p[1]} · ${ci ? formatDay(ci, locale, { day: 'numeric', month: 'short' }) : ''} → ${co ? formatDay(co, locale, { day: 'numeric', month: 'short', year: 'numeric' }) : ''} · ${(b.source as Record<string, string>)[src ?? ''] ?? src}` };
    }
    case 'stay': return { title: p[0] === 'stay.in' ? t.tl.in(p[1] ?? '') : t.tl.out(p[1] ?? '') };
    case 'charge': return { title: p[2] ?? '', sub: t.spendType[p[1] ?? ''] ?? p[1] };
    case 'payment': return { title: p[2] === 'refund' ? t.tl.refund : p[2] === 'deposit' ? t.tl.deposit : t.tl.payment, sub: (b.pay.methods as Record<string, string>)[p[1] ?? ''] ?? p[1] };
    case 'spa': return { title: t.tl.spa(p[1] ?? ''), sub: p[2] };
    case 'message': {
      const who = p[2] === 'guest' ? t.tl.msgGuest : p[2] === 'ai' ? t.tl.msgAi : p[2] === 'staff' ? t.tl.msgStaff : t.tl.msgSystem;
      return { title: who(ch(p[1] ?? '')), sub: item.detail };
    }
    case 'call': return { title: t.tl.call(Math.max(1, Math.round(Number(p[1]) / 60))), sub: item.detail };
    case 'invoice': return { title: t.tl.invoice(p[1] ?? ''), sub: p[2] };
    case 'note': return { title: t.tl.note(p[1] ?? ''), sub: item.detail };
    case 'profile': return { title: (t.tl.profile[p[1] ?? ''] ?? p[1] ?? '') + t.tl.by(p[2] ?? '') };
  }
}

function Activity({ data, t, locale, money }: { data: Profile; t: ProfileCopy; locale: string; money: (n: number) => string }) {
  const [filter, setFilter] = useState('all');
  const [limit, setLimit] = useState(40);
  const items = useMemo(() => data.timeline.filter((i) => !FILTERS[filter] || FILTERS[filter]!.includes(i.kind)), [data.timeline, filter]);
  const groups = useMemo(() => {
    const m = new Map<string, TimelineItem[]>();
    for (const i of items.slice(0, limit)) {
      const k = i.at.slice(0, 7);
      m.set(k, [...(m.get(k) ?? []), i]);
    }
    return [...m.entries()];
  }, [items, limit]);
  const now = new Date();

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {Object.keys(FILTERS).map((f) => {
          const n = f === 'all' ? data.timeline.length : data.timeline.filter((i) => FILTERS[f]!.includes(i.kind)).length;
          return (
            <button key={f} type="button" onClick={() => { setFilter(f); setLimit(40); }} className={cn('inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-xs transition-all', filter === f ? 'border-transparent bg-ionian-900 text-limestone-50' : 'border-border-strong text-muted hover:-translate-y-px hover:text-foreground')}>
              {t.filters[f as keyof ProfileCopy['filters']]} <span className="tabular-nums opacity-60">{n}</span>
            </button>
          );
        })}
      </div>
      {items.length === 0 && <p className="bg-qilim mt-8 rounded-2xl border border-dashed border-border-strong py-16 text-center font-serif text-xl text-muted">{t.emptyActivity}</p>}
      <div className="mt-8 space-y-10">
        {groups.map(([month, list]) => (
          <section key={month}>
            <p className="sticky top-0 z-10 mb-4 bg-background/90 py-1 text-xs font-medium tracking-[0.2em] text-subtle uppercase backdrop-blur">{formatDay(`${month}-01`, locale, { month: 'long', year: 'numeric' })}</p>
            <ol className="relative space-y-1 border-l border-border pl-8">
              {list.map((i, idx) => {
                const Icon = KIND_ICON[i.kind];
                const d = describe(i, t, locale);
                const body = (
                  <>
                    <span className={cn('absolute -left-[2.05rem] grid size-8 place-items-center rounded-full ring-4 ring-background', KIND_TONE[i.kind])}><Icon className="size-3.5" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{d.title}{i.tone === 'ai' && <Sparkles className="ml-1.5 inline size-3.5 text-accent" />}</p>
                      {d.sub && <p className={cn('mt-0.5 text-[13px] text-muted', i.kind === 'message' || i.kind === 'note' ? 'line-clamp-2 italic' : 'truncate')}>{i.kind === 'message' || i.kind === 'note' ? `“${d.sub}”` : d.sub}</p>}
                      <p className="mt-1 text-[11px] text-subtle" title={new Date(i.at).toLocaleString(locale === 'en' ? 'en-GB' : 'sq-AL')}>{relativeTime(new Date(i.at), locale, now)}</p>
                    </div>
                    {i.amount !== undefined && i.amount !== 0 && <span className={cn('shrink-0 font-serif text-lg tabular-nums', i.tone === 'bad' || i.amount < 0 ? 'text-danger' : i.kind === 'payment' ? 'text-success' : '')}>{money(i.amount)}</span>}
                    {i.href && <ArrowUpRight className="size-4 shrink-0 text-subtle opacity-0 transition-opacity group-hover:opacity-100" />}
                  </>
                );
                return (
                  <motion.li key={i.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(idx, 8) * 0.03 }} className="relative">
                    {i.href ? <Link href={i.href} className="group flex items-start gap-4 rounded-xl px-3 py-3 transition-colors hover:bg-surface-2">{body}</Link> : <div className="group flex items-start gap-4 rounded-xl px-3 py-3">{body}</div>}
                  </motion.li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
      {items.length > limit && <button type="button" onClick={() => setLimit((l) => l + 40)} className="mt-6 h-10 w-full rounded-full border border-border-strong text-sm text-muted hover:bg-surface-2">{t.more} ({items.length - limit})</button>}
    </div>
  );
}

function Stays({ data, t, locale, money }: { data: Profile; t: ProfileCopy; locale: string; money: (n: number) => string }) {
  const b = pickBookingCopy(locale);
  const max = Math.max(1, ...data.seasonality);
  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
        <p className="text-xs tracking-wider text-muted uppercase">{t.stays.season}</p>
        <div className="mt-5 flex h-32 items-end gap-2">
          {data.seasonality.map((v, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-2">
              <motion.div initial={{ height: 0 }} animate={{ height: `${(v / max) * 100}%` }} transition={{ delay: i * 0.04, duration: 0.7, ease: [0.16, 1, 0.3, 1] }} className={cn('w-full min-h-1 rounded-t-md', v ? 'bg-gradient-to-t from-ionian-700 to-ionian-400' : 'bg-surface-3')} title={t.stays.nights(v)} />
              <span className="text-[10px] text-subtle">{t.months[i]}</span>
            </div>
          ))}
        </div>
      </div>
      {data.stayList.length === 0 && <p className="py-12 text-center font-serif text-xl text-muted">{t.stays.empty}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {data.stayList.map((st, i) => (
          <motion.div key={st.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.04 }} whileHover={{ y: -4 }}>
            <Link href={`/app/bookings?view=all&b=${st.id}`} className={cn('flex gap-4 rounded-2xl border bg-surface p-5 shadow-soft transition-shadow hover:shadow-lift', st.status === 'cancelled' || st.status === 'no_show' ? 'border-border opacity-60' : 'border-border')}>
              <div className="flex w-16 shrink-0 flex-col items-center rounded-xl bg-surface-2 py-2.5">
                <span className="font-serif text-3xl leading-none tabular-nums">{formatDay(st.checkIn, locale, { day: 'numeric' })}</span>
                <span className="mt-1 text-[10px] tracking-wider text-muted uppercase">{formatDay(st.checkIn, locale, { month: 'short' })}</span>
                <span className="text-[10px] text-subtle">{st.checkIn.slice(0, 4)}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2"><p className="truncate font-medium">{st.type}{st.room ? ` · ${st.room}` : ''}</p><span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px]">{t.status[st.status]}</span></div>
                <p className="mt-1 text-xs text-muted">{t.stays.nights(st.nights)} · {t.stays.people(st.adults, st.children)}</p>
                <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-muted"><span className="size-2 rounded-full" style={{ background: SOURCE_COLOR[st.source as BookingSource] }} />{b.source[st.source] ?? st.source} · {st.code}</p>
                {st.requests && <p className="mt-2 line-clamp-2 text-xs text-muted italic">“{st.requests}”</p>}
                <p className="mt-2 font-serif text-2xl tabular-nums">{money(st.total)}{st.extras > 0 && <span className="ml-2 font-sans text-xs text-accent">+{money(st.extras)} {t.stays.extras}</span>}</p>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

const SPEND_COLORS = ['bg-ionian-500', 'bg-gold-500', 'bg-olive-500', 'bg-terracotta-400', 'bg-ionian-300', 'bg-gold-400', 'bg-limestone-500', 'bg-olive-400'];
function Spend({ data, t, money }: { data: Profile; t: ProfileCopy; money: (n: number) => string }) {
  const total = data.spend.reduce((n, x) => n + Math.max(0, x.amount), 0);
  if (!total) return <p className="py-12 text-center font-serif text-xl text-muted">{t.spend.empty}</p>;
  const maxFav = Math.max(1, ...data.favourites.map((f) => f.n));
  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
        <div className="flex items-baseline justify-between"><p className="text-xs tracking-wider text-muted uppercase">{t.spend.title}</p><p className="text-xs text-muted">{t.spend.perStay}: <b className="text-foreground">{money(data.stats.avgSpendPerStay)}</b></p></div>
        <div className="mt-5 flex h-5 overflow-hidden rounded-full">
          {data.spend.filter((x) => x.amount > 0).map((x, i) => <motion.div key={x.type} initial={{ width: 0 }} animate={{ width: `${(x.amount / total) * 100}%` }} transition={{ delay: i * 0.08, duration: 0.8, ease: [0.16, 1, 0.3, 1] }} className={SPEND_COLORS[i % SPEND_COLORS.length]} title={`${t.spendType[x.type] ?? x.type}: ${money(x.amount)}`} />)}
        </div>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {data.spend.filter((x) => x.amount > 0).map((x, i) => (
            <li key={x.type} className="flex items-center gap-3 text-sm"><span className={cn('size-3 rounded', SPEND_COLORS[i % SPEND_COLORS.length])} /><span className="flex-1">{t.spendType[x.type] ?? x.type}</span><span className="tabular-nums text-muted">{Math.round((x.amount / total) * 100)}%</span><span className="w-20 text-right font-medium tabular-nums">{money(x.amount)}</span></li>
          ))}
        </ul>
      </div>
      {data.favourites.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-soft">
          <p className="text-xs tracking-wider text-muted uppercase">{t.spend.favourites}</p>
          <ul className="mt-5 space-y-3">
            {data.favourites.map((f, i) => (
              <li key={f.name} className="text-sm">
                <div className="flex justify-between gap-3"><span className="truncate">{f.name}</span><span className="shrink-0 text-muted tabular-nums">{t.spend.times(Math.round(f.n))} · {money(f.amount)}</span></div>
                <div className="mt-1.5 h-1.5 rounded-full bg-surface-2"><motion.div initial={{ width: 0 }} animate={{ width: `${(f.n / maxFav) * 100}%` }} transition={{ delay: i * 0.05, duration: 0.7 }} className="h-full rounded-full bg-gradient-to-r from-gold-500 to-gold-400" /></div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Preferences({ guestId, prefs, t, onSaved }: { guestId: string; prefs: GuestPreferences; t: ProfileCopy; onSaved: () => void }) {
  const act = useAction(t.errors);
  const [p, setP] = useState<GuestPreferences>(prefs);
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [occ, setOcc] = useState({ label: '', date: '' });
  const [saved, setSaved] = useState(false);
  const dirty = JSON.stringify(p) !== JSON.stringify(prefs);
  const toggle = (cat: (typeof PREF_CATS)[number], v: string) => {
    setSaved(false);
    setP((x) => { const cur = x[cat] ?? []; return { ...x, [cat]: cur.includes(v) ? cur.filter((y) => y !== v) : [...cur, v] }; });
  };
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">{t.prefs.hint}</p>
      {PREF_CATS.map((cat) => {
        const selected = p[cat] ?? [];
        const options = [...new Set([...(t.prefs.suggest[cat] ?? []), ...selected])];
        return (
          <div key={cat} className={cn('rounded-2xl border p-5', cat === 'allergies' && selected.length ? 'border-danger/40 bg-danger-soft/40' : 'border-border bg-surface')}>
            <p className={cn('text-xs tracking-wider uppercase', cat === 'allergies' ? 'text-danger' : 'text-muted')}>{t.prefs.cats[cat]}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {options.map((o) => {
                const on = selected.includes(o);
                return (
                  <motion.button key={o} type="button" layout whileTap={{ scale: 0.92 }} onClick={() => toggle(cat, o)} className={cn('inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm transition-colors', on ? (cat === 'allergies' ? 'border-transparent bg-danger text-white' : 'border-transparent bg-ionian-900 text-limestone-50') : 'border-border-strong text-muted hover:text-foreground')}>
                    {on && <Check className="size-3.5" />}{o}
                  </motion.button>
                );
              })}
              <form onSubmit={(e) => { e.preventDefault(); const v = (custom[cat] ?? '').trim(); if (v) { toggle(cat, v); setCustom((c) => ({ ...c, [cat]: '' })); } }} className="inline-flex">
                <input value={custom[cat] ?? ''} onChange={(e) => setCustom((c) => ({ ...c, [cat]: e.target.value }))} placeholder={t.prefs.add} className="h-9 w-32 rounded-full border border-dashed border-border-strong bg-transparent px-3.5 text-sm outline-none focus:w-44 focus:border-ionian-400" />
              </form>
            </div>
          </div>
        );
      })}
      <div className="rounded-2xl border border-border bg-surface p-5">
        <p className="text-xs tracking-wider text-muted uppercase">{t.prefs.occasions}</p>
        <ul className="mt-3 space-y-2">
          {(p.occasions ?? []).map((o, i) => (
            <li key={i} className="flex items-center gap-3 text-sm"><Cake className="size-4 text-accent" /><span className="flex-1">{o.label}</span><span className="font-mono text-xs text-muted">{o.date}</span><button type="button" onClick={() => setP((x) => ({ ...x, occasions: (x.occasions ?? []).filter((_, j) => j !== i) }))} className="text-subtle hover:text-danger"><X className="size-4" /></button></li>
          ))}
        </ul>
        <form onSubmit={(e) => { e.preventDefault(); if (occ.label && /^\d{2}-\d{2}$/.test(occ.date)) { setP((x) => ({ ...x, occasions: [...(x.occasions ?? []), occ] })); setOcc({ label: '', date: '' }); } }} className="mt-3 flex gap-2">
          <Input value={occ.label} onChange={(e) => setOcc({ ...occ, label: e.target.value })} placeholder={t.prefs.occasionLabel} />
          <Input value={occ.date} onChange={(e) => setOcc({ ...occ, date: e.target.value })} placeholder={t.prefs.occasionDate} className="w-28" />
          <Button type="submit" variant="secondary"><Plus /></Button>
        </form>
      </div>
      <div className="sticky bottom-4 flex items-center justify-end gap-3">
        {act.message && <span className="text-sm text-danger">{act.message}</span>}
        {saved && !dirty && <span className="text-sm text-success">{t.prefs.saved}</span>}
        <Button disabled={!dirty || act.pending} onClick={() => act.run(() => saveGuestPreferences({ guestId, preferences: p }), () => { setSaved(true); onSaved(); })} className="shadow-float">{t.prefs.save}</Button>
      </div>
    </div>
  );
}

function Messages({ data, t, locale }: { data: Profile; t: ProfileCopy; locale: string }) {
  if (!data.conversations.length) return <p className="py-12 text-center font-serif text-xl text-muted">{t.messages.empty}</p>;
  return (
    <div className="space-y-5">
      {data.conversations.map((c) => (
        <div key={c.id} className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
          <div className="flex items-center justify-between gap-3"><p className="text-sm font-medium capitalize">{c.channel.replace('_', ' ')}</p><span className="text-xs text-subtle">{relativeTime(new Date(c.lastAt), locale)}</span></div>
          <div className="mt-4 space-y-2">
            {c.messages.map((m) => (
              <div key={m.id} className={cn('flex', m.author === 'guest' ? 'justify-start' : 'justify-end')}>
                <p className={cn('max-w-[80%] rounded-2xl px-3.5 py-2 text-sm', m.author === 'guest' ? 'rounded-bl-md bg-surface-2' : m.author === 'ai' ? 'ai-glow rounded-br-md' : 'rounded-br-md bg-ionian-900 text-limestone-50')}>{m.body}</p>
              </div>
            ))}
          </div>
          <Link href={`/app/inbox?c=${c.id}`} className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">{t.messages.open} <ArrowUpRight className="size-3.5" /></Link>
        </div>
      ))}
    </div>
  );
}

function Notes({ data, t, locale, canManage, onDone }: { data: Profile; t: ProfileCopy; locale: string; canManage: boolean; onDone: () => void }) {
  const act = useAction(t.errors);
  const [text, setText] = useState('');
  const [pinned, setPinned] = useState(false);
  const notes = [...data.notes].sort((a, b) => Number(b.pinned) - Number(a.pinned));
  return (
    <div className="space-y-5">
      <form onSubmit={(e) => { e.preventDefault(); if (text.trim()) act.run(() => addGuestNote({ guestId: data.guest.id, text, pinned }), () => { setText(''); setPinned(false); onDone(); }); }} className="rounded-2xl border border-border bg-surface p-4 shadow-soft">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={1500} placeholder={t.notes.placeholder} className="w-full resize-none bg-transparent text-sm outline-none" />
        <div className="mt-2 flex items-center justify-between">
          <button type="button" onClick={() => setPinned((v) => !v)} className={cn('inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs', pinned ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2')}><Pin className="size-3.5" /> {t.notes.pin}</button>
          <Button size="sm" disabled={act.pending || !text.trim()}>{t.notes.add}</Button>
        </div>
      </form>
      {notes.length === 0 && <p className="py-8 text-center text-sm text-muted">{t.notes.empty}</p>}
      <AnimatePresence initial={false}>
        {notes.map((n) => (
          <motion.div key={n.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 30 }} className={cn('rounded-2xl border p-5', n.pinned ? 'border-gold-400/50 bg-gold-100/40 dark:bg-gold-400/10' : 'border-border bg-surface')}>
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ionian-900 text-xs font-medium text-limestone-50">{(n.author ?? 'S').slice(0, 1)}</span>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted"><b className="text-foreground">{n.author ?? '—'}</b> · {relativeTime(new Date(n.at), locale)}{n.pinned && <span className="ml-2 text-accent">📌 {t.notes.pinned}</span>}</p>
                <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap">{n.text}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button type="button" title={n.pinned ? t.notes.unpin : t.notes.pin} onClick={() => act.run(() => setNotePinned({ noteId: n.id, pinned: !n.pinned }), onDone)} className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface-2">{n.pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}</button>
                {(n.mine || canManage) && <button type="button" title={t.notes.delete} onClick={() => act.run(() => deleteGuestNote(n.id), onDone)} className="grid size-8 place-items-center rounded-full text-muted hover:bg-danger-soft hover:text-danger"><Trash2 className="size-4" /></button>}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function Privacy({ data, t, locale, canManage, onDone }: { data: Profile; t: ProfileCopy; locale: string; canManage: boolean; onDone: () => void }) {
  const act = useAction(t.errors);
  const [confirming, setConfirming] = useState(false);
  const g = data.guest;
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5">
        <div><p className="font-medium">{t.privacy.consent}</p><p className="mt-1 text-sm text-muted">{t.privacy.consentHint}</p></div>
        <button type="button" role="switch" aria-checked={g.marketingConsent} disabled={act.pending} onClick={() => act.run(() => setGuestFlags({ guestId: g.id, marketingConsent: !g.marketingConsent }), onDone)} className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors', g.marketingConsent ? 'bg-success' : 'bg-surface-3')}>
          <motion.span layout className={cn('absolute top-0.5 size-6 rounded-full bg-white shadow', g.marketingConsent ? 'left-[22px]' : 'left-0.5')} />
        </button>
      </div>
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface p-5">
        <ShieldCheck className="size-6 shrink-0 text-success" />
        <p className="text-sm">{g.documentDeleteAfter ? `${t.privacy.retention}: ${formatDay(g.documentDeleteAfter.slice(0, 10), locale, { day: 'numeric', month: 'long', year: 'numeric' })}` : t.privacy.noDoc}</p>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5">
        <p className="max-w-md text-sm text-muted">{t.privacy.exportHint}</p>
        <a href={`/api/guests/${g.id}/export`} className="inline-flex h-10 items-center gap-2 rounded-full border border-border-strong px-5 text-sm hover:bg-surface-2"><Download className="size-4" /> {t.actions.export}</a>
      </div>
      {canManage && (
        <div className="rounded-2xl border border-danger/40 bg-danger-soft/40 p-5">
          <p className="font-medium text-danger">{t.actions.anonymize}</p>
          <p className="mt-1 text-sm text-muted">{t.privacy.anonymizeHint}</p>
          {!confirming ? (
            <Button variant="danger" size="sm" className="mt-4" onClick={() => setConfirming(true)}>{t.actions.anonymize}</Button>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium">{t.privacy.sure}</span>
              <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>{t.privacy.cancel}</Button>
              <Button variant="danger" size="sm" disabled={act.pending} onClick={() => act.run(() => anonymizeGuest(g.id), () => { setConfirming(false); onDone(); })}>{t.privacy.confirmAnonymize}</Button>
            </div>
          )}
          {act.message && <p className="mt-2 text-sm text-danger">{act.message}</p>}
        </div>
      )}
    </div>
  );
}

/* ───────────── side rail ───────────── */

function BriefCard({ guestId, t, locale }: { guestId: string; t: ProfileCopy; locale: string }) {
  const act = useAction(t.errors);
  const [text, setText] = useState<string | null>(null);
  return (
    <div className="ai-glow relative overflow-hidden rounded-2xl p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm font-medium"><Sparkles className="size-4 text-accent" /> {t.side.brief}</p>
        <button type="button" disabled={act.pending} onClick={() => act.run(() => aiGuestBrief({ guestId, locale }), (r) => setText(r.text))} className="inline-flex h-8 items-center rounded-full bg-ionian-900 px-3.5 text-xs text-limestone-50 disabled:opacity-60">{act.pending ? '…' : text ? t.side.regenerate : t.side.generate}</button>
      </div>
      {!text && !act.pending && <p className="mt-2 text-xs text-muted">{t.side.briefHint}</p>}
      {act.pending && <div className="mt-4 space-y-2">{[90, 75, 85, 60].map((w, i) => <motion.div key={i} className="h-3 rounded bg-surface-3" style={{ width: `${w}%` }} animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15 }} />)}</div>}
      {text && !act.pending && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 space-y-2.5 text-sm leading-relaxed">{text.split('\n').filter(Boolean).map((l, i) => <motion.p key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.12 }}>{l}</motion.p>)}</motion.div>}
      {act.message && <p className="mt-2 text-xs text-danger">{act.message}</p>}
    </div>
  );
}

function ComposeCard({ guestId, t, locale, phone, email, purpose, setPurpose }: { guestId: string; t: ProfileCopy; locale: string; phone: string; email: string | null; purpose: string | null; setPurpose: (p: string | null) => void }) {
  const act = useAction(t.errors);
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);
  const gen = (p: string) => { setPurpose(p); act.run(() => aiGuestMessage({ guestId, purpose: p, locale }), (r) => setText(r.text)); };
  return (
    <div id="compose" className={cn('rounded-2xl border bg-surface p-5 shadow-soft transition-colors', purpose ? 'border-accent/50' : 'border-border')}>
      <p className="flex items-center gap-2 text-sm font-medium"><MessageCircle className="size-4 text-[#2fa36b]" /> {t.side.compose}</p>
      <p className="mt-1 text-xs text-muted">{t.side.composeHint}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {Object.entries(t.side.purposes).map(([k, v]) => <button key={k} type="button" disabled={act.pending} onClick={() => gen(k)} className={cn('h-8 rounded-full border px-3 text-xs transition-all hover:-translate-y-px', purpose === k ? 'border-transparent bg-ionian-900 text-limestone-50' : 'border-border-strong text-muted hover:text-foreground')}>{v}</button>)}
      </div>
      {act.pending && <div className="mt-4 h-24 animate-pulse rounded-xl bg-surface-2" />}
      {text && !act.pending && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} className="w-full resize-none rounded-xl border border-border-strong bg-surface-2 p-3 text-sm outline-none focus:border-ionian-400" />
          <div className="mt-2 flex flex-wrap gap-2">
            {phone && <a href={`https://wa.me/${phone}?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[#2fa36b] px-3.5 text-xs font-medium text-white"><MessageCircle className="size-3.5" /> {t.side.sendWa}</a>}
            {email && <a href={`mailto:${email}?body=${encodeURIComponent(text)}`} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border-strong px-3.5 text-xs"><Mail className="size-3.5" /> {t.side.sendEmail}</a>}
            <button type="button" onClick={() => { void navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border-strong px-3.5 text-xs">{copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? t.side.copied : t.side.copy}</button>
          </div>
        </motion.div>
      )}
      {act.message && <p className="mt-2 text-xs text-danger">{act.message}</p>}
    </div>
  );
}

function Completeness({ value, missing, t, onEdit }: { value: number; missing: string[]; t: ProfileCopy; onEdit: () => void }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <div className="flex items-center justify-between"><p className="text-sm font-medium">{t.side.completeness}</p><span className="font-serif text-2xl tabular-nums">{value}%</span></div>
      <div className="mt-3 h-2 rounded-full bg-surface-2"><motion.div initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }} className={cn('h-full rounded-full', value >= 80 ? 'bg-success' : value >= 50 ? 'bg-gold-400' : 'bg-terracotta-400')} /></div>
      {missing.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted">{t.side.missing}:</span>
          {missing.map((m) => <button key={m} type="button" onClick={onEdit} className="rounded-full border border-dashed border-border-strong px-2.5 py-0.5 text-[11px] text-muted hover:border-ionian-400 hover:text-foreground">+ {t.side.fields[m] ?? m}</button>)}
        </div>
      )}
    </div>
  );
}

function Duplicates({ data, t, onDone }: { data: Profile; t: ProfileCopy; onDone: () => void }) {
  const act = useAction(t.errors);
  const [ask, setAsk] = useState<Profile['duplicates'][number] | null>(null);
  return (
    <div className={cn('rounded-2xl border p-5 shadow-soft', data.duplicates.length ? 'border-gold-400/50 bg-gold-100/30 dark:bg-gold-400/5' : 'border-border bg-surface')}>
      <p className="flex items-center gap-2 text-sm font-medium"><GitMerge className="size-4 text-accent" /> {t.side.duplicates}</p>
      {data.duplicates.length === 0 ? <p className="mt-2 text-xs text-success">{t.side.noDup}</p> : (
        <>
          <p className="mt-1 text-xs text-muted">{t.side.dupHint}</p>
          <ul className="mt-3 space-y-2">
            {data.duplicates.map((d) => (
              <li key={d.id} className="rounded-xl border border-border bg-surface p-3">
                <div className="flex items-center justify-between gap-2"><Link href={`/app/guests/${d.id}`} className="truncate text-sm font-medium hover:underline">{d.name}</Link><span className="shrink-0 text-[11px] font-medium text-accent">{d.confidence}%</span></div>
                <p className="mt-0.5 truncate text-[11px] text-muted">{d.why.map((w) => t.side.why[w]).join(' · ')} · {d.bookings} {t.side.bookings.toLowerCase()}</p>
                <button type="button" onClick={() => setAsk(d)} className="mt-2 inline-flex h-7 items-center gap-1.5 rounded-full bg-ionian-900 px-3 text-[11px] text-limestone-50"><GitMerge className="size-3" /> {t.side.merge}</button>
              </li>
            ))}
          </ul>
        </>
      )}
      {ask && (
        <Dialog open onOpenChange={(o) => !o && setAsk(null)}>
          <DialogContent closeLabel="×">
            <DialogHeader><DialogTitle>{t.side.merge}</DialogTitle></DialogHeader>
            <p className="text-sm">{t.side.mergeConfirm(ask.name)}</p>
            {act.message && <p className="mt-2 text-sm text-danger">{act.message}</p>}
            <DialogFooter><Button variant="ghost" onClick={() => setAsk(null)}>{t.privacy.cancel}</Button><Button disabled={act.pending} onClick={() => act.run(() => mergeGuests({ keepId: data.guest.id, dropId: ask.id }), () => { setAsk(null); onDone(); })}><GitMerge /> {t.side.merge}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function Tags({ guestId, tags, t, onDone }: { guestId: string; tags: string[]; t: ProfileCopy; onDone: () => void }) {
  const act = useAction(t.errors);
  const [v, setV] = useState('');
  const save = (next: string[]) => act.run(() => setGuestFlags({ guestId, tags: next }), onDone);
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <p className="text-sm font-medium">{t.side.tags}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <AnimatePresence>
          {tags.map((tag) => (
            <motion.span key={tag} layout initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} className="inline-flex items-center gap-1 rounded-full bg-surface-2 py-1 pr-1.5 pl-3 text-xs">
              #{tag}<button type="button" onClick={() => save(tags.filter((x) => x !== tag))} className="grid size-4 place-items-center rounded-full text-subtle hover:bg-surface-3 hover:text-foreground"><X className="size-3" /></button>
            </motion.span>
          ))}
        </AnimatePresence>
        <form onSubmit={(e) => { e.preventDefault(); const x = v.trim().toLowerCase().replace(/^#/, ''); if (x && !tags.includes(x)) { save([...tags, x]); setV(''); } }}>
          <input value={v} onChange={(e) => setV(e.target.value)} placeholder={t.side.addTag} maxLength={24} className="h-7 w-28 rounded-full border border-dashed border-border-strong bg-transparent px-3 text-xs outline-none focus:border-ionian-400" />
        </form>
      </div>
    </div>
  );
}

function EditDialog({ data, t, onClose, onDone }: { data: Profile; t: ProfileCopy; onClose: () => void; onDone: () => void }) {
  const act = useAction(t.errors);
  const g = data.guest;
  const [f, setF] = useState({ firstName: g.firstName, lastName: g.lastName, email: g.email ?? '', phone: g.phone ?? '', nationality: g.nationality ?? '', language: g.language ?? '', dateOfBirth: g.dateOfBirth ?? '', documentType: g.documentType ?? '', documentNumber: g.documentNumber ?? '', address: g.address ?? '', city: g.city ?? '', country: g.country ?? '' });
  const E = t.edit;
  const field = (k: keyof typeof f, type = 'text', span = false) => (
    <div className={span ? 'col-span-2' : ''}><Label>{E[k]}</Label><Input type={type} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>
  );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel="×" className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{E.title}</DialogTitle></DialogHeader>
        <form className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); act.run(() => updateGuestDetails({ guestId: g.id, ...f }), onDone); }}>
          {field('firstName')}{field('lastName')}{field('email', 'email')}{field('phone', 'tel')}{field('nationality')}{field('language')}{field('dateOfBirth', 'date')}{field('documentType')}{field('documentNumber')}{field('city')}{field('address', 'text', true)}{field('country')}
          {act.message && <p className="col-span-2 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{act.message}</p>}
          <DialogFooter className="col-span-2"><Button type="button" variant="ghost" onClick={onClose}>{E.cancel}</Button><Button type="submit" disabled={act.pending}>{E.save}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
