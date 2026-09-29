'use client';

import Link from 'next/link';
import { useMemo, useRef, useState, useTransition } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { ArrowRight, BedDouble, Check, Coffee, Flower2, MapPin, Maximize2, Phone, Users, Waves, Wine } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { addDays, diffDays, formatDay } from '@/lib/dates';
import { formatCurrency, type Currency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { createWebBooking, searchStay, sendInquiry, type SearchResult } from '@/server/actions/public';
import type { getPublicContent } from '@/server/services/public-site';
import { pickResortCopy } from './copy';
import { RoomArt, SeaHero } from './sea-art';

type Content = Awaited<ReturnType<typeof getPublicContent>>;
type RoomType = Content['types'][number];

type Props = {
  slug: string;
  name: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  coverImage: string | null;
  currency: Currency;
  locale: string;
  today: string;
  content: Content;
  chat?: React.ReactNode;
};

const field = 'h-11 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-sm outline-none focus:border-ionian-400 focus:ring-4 focus:ring-ring/30';
const reveal = { initial: { opacity: 0, y: 28 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-80px' }, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const } };

export function ResortSite(props: Props) {
  const { slug, name, city, address, phone, email, coverImage, currency, locale, today, content } = props;
  const t = pickResortCopy(locale);
  const money = (n: number) => formatCurrency(n, currency, locale, 0);

  const [checkIn, setCheckIn] = useState(addDays(today, 7));
  const [checkOut, setCheckOut] = useState(addDays(today, 10));
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [picked, setPicked] = useState<RoomType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const artY = useTransform(scrollYProgress, [0, 1], ['0%', '22%']);
  const titleY = useTransform(scrollYProgress, [0, 1], ['0%', '40%']);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  const nights = Math.max(0, diffDays(checkOut, checkIn));

  function search(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    start(async () => {
      const res = await searchStay({ slug, checkIn, checkOut, adults, children, locale });
      if (!res.ok) {
        setError(t.errors[res.error] ?? t.errors.unknown!);
        return;
      }
      setResult(res.data);
      setPicked(null);
      setOpen(true);
    });
  }

  const optionOf = (id: string) => result?.options.find((o) => o.typeId === id);
  const roomsRef = useMemo(() => content.types, [content.types]);

  return (
    <div data-theme="day" className="bg-limestone-50 text-ionian-950">
      {/* nav */}
      <header className="fixed inset-x-0 top-0 z-40 flex items-center justify-between px-5 py-4 text-limestone-50 mix-blend-normal md:px-10">
        <a href="#top" className="font-display text-2xl tracking-tight drop-shadow">{name}</a>
        <nav className="hidden items-center gap-7 text-sm md:flex">
          {(['rooms', 'experiences', 'spa', 'contact'] as const).map((k) => (
            <a key={k} href={`#${k}`} className="opacity-80 drop-shadow transition-opacity hover:opacity-100">{t.nav[k]}</a>
          ))}
          <Link href={locale === 'en' ? `/r/${slug}` : `/en/r/${slug}`} className="rounded-full border border-white/30 px-3 py-1 text-xs uppercase">{locale === 'en' ? 'SQ' : 'EN'}</Link>
        </nav>
        <a href="#book" className="rounded-full bg-limestone-50 px-5 py-2 text-sm font-medium text-ionian-950 shadow-lg md:hidden">{t.book}</a>
      </header>

      {/* hero */}
      <div id="top" ref={heroRef} className="relative h-[100svh] min-h-[640px] overflow-hidden bg-ionian-950 text-limestone-50">
        <motion.div style={{ y: artY }} className="absolute inset-[-6%]">
          {coverImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverImage} alt="" className="size-full object-cover" />
          ) : (
            <SeaHero className="size-full" />
          )}
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-b from-ionian-950/50 via-transparent to-ionian-950/80" />
        <motion.div style={{ y: titleY, opacity: fade }} className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
          <motion.p initial={{ opacity: 0, letterSpacing: '0.1em' }} animate={{ opacity: 1, letterSpacing: '0.42em' }} transition={{ duration: 1.4 }} className="text-[11px] text-gold-400 uppercase md:text-xs">
            {t.eyebrow}
          </motion.p>
          <h1 className="font-display mt-6 max-w-5xl text-6xl leading-[0.95] tracking-tight md:text-9xl">
            {name.split(' ').map((w, i) => (
              <motion.span key={i} initial={{ opacity: 0, y: 40, filter: 'blur(10px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ delay: 0.15 + i * 0.12, duration: 1, ease: [0.16, 1, 0.3, 1] }} className="mr-[0.25em] inline-block">
                {w}
              </motion.span>
            ))}
          </h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9, duration: 1 }} className="mt-6 max-w-lg text-base text-ionian-100 md:text-lg">
            {t.heroSub}
          </motion.p>
        </motion.div>

        {/* booking bar */}
        <form id="book" onSubmit={search} className="absolute inset-x-4 bottom-8 z-20 mx-auto max-w-5xl md:bottom-12">
          <div className="grid gap-3 rounded-3xl border border-white/20 bg-white/12 p-3 shadow-float backdrop-blur-2xl md:grid-cols-[1fr_1fr_0.7fr_0.7fr_auto] md:items-end md:p-4">
            <label className="block text-[11px] tracking-wider text-ionian-100 uppercase">
              {t.checkIn}
              <input type="date" className={cn(field, 'mt-1 border-white/20 bg-white/90 text-ionian-950')} min={today} value={checkIn} onChange={(e) => { setCheckIn(e.target.value); if (e.target.value >= checkOut) setCheckOut(addDays(e.target.value, 1)); }} required />
            </label>
            <label className="block text-[11px] tracking-wider text-ionian-100 uppercase">
              {t.checkOut}
              <input type="date" className={cn(field, 'mt-1 border-white/20 bg-white/90 text-ionian-950')} min={addDays(checkIn, 1)} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} required />
            </label>
            <label className="block text-[11px] tracking-wider text-ionian-100 uppercase">
              {t.adults}
              <input type="number" min={1} max={10} className={cn(field, 'mt-1 border-white/20 bg-white/90 text-ionian-950')} value={adults} onChange={(e) => setAdults(Math.max(1, Number(e.target.value)))} />
            </label>
            <label className="block text-[11px] tracking-wider text-ionian-100 uppercase">
              {t.children}
              <input type="number" min={0} max={8} className={cn(field, 'mt-1 border-white/20 bg-white/90 text-ionian-950')} value={children} onChange={(e) => setChildren(Math.max(0, Number(e.target.value)))} />
            </label>
            <button type="submit" disabled={pending} className="group inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gold-400 px-6 text-sm font-semibold text-ionian-950 transition-all hover:bg-gold-500 hover:shadow-lg disabled:opacity-60">
              {pending ? t.searching : t.search}
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
          <p className="mt-3 text-center text-xs text-ionian-100/90">{error ?? t.directBest}</p>
        </form>
      </div>

      {/* rooms */}
      <section id="rooms" className="mx-auto max-w-7xl px-5 py-24 md:px-10 md:py-36">
        <motion.div {...reveal} className="max-w-2xl">
          <p className="text-xs tracking-[0.3em] text-accent uppercase">{t.nav.rooms}</p>
          <h2 className="font-display mt-4 text-5xl md:text-7xl">{t.roomsTitle}</h2>
          <p className="mt-4 text-lg text-limestone-700">{t.roomsSub}</p>
        </motion.div>
        <div className="mt-20 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {roomsRef.map((r, i) => (
            <motion.article key={r.id} {...reveal} transition={{ ...reveal.transition, delay: (i % 3) * 0.08 }} className="group overflow-hidden rounded-3xl border border-limestone-200 bg-white shadow-soft transition-shadow hover:shadow-lift">
              <div className="relative aspect-[4/3] overflow-hidden">
                {r.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.images[0]} alt={r.name} className="size-full object-cover transition-transform duration-700 group-hover:scale-105" />
                ) : (
                  <RoomArt seed={i} className="size-full transition-transform duration-700 group-hover:scale-105" />
                )}
                <span className="absolute top-4 left-4 rounded-full bg-white/85 px-3 py-1 text-xs font-medium backdrop-blur">{t.from} {money(r.basePrice)} / {t.perNight}</span>
              </div>
              <div className="p-6">
                <h3 className="font-display text-3xl">{r.name}</h3>
                <p className="mt-2 line-clamp-2 text-sm text-limestone-700">{r.description}</p>
                <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-limestone-600">
                  {r.sizeSqm && <span className="inline-flex items-center gap-1"><Maximize2 className="size-3.5" /> {r.sizeSqm} {t.sqm}</span>}
                  <span className="inline-flex items-center gap-1"><Users className="size-3.5" /> {t.upTo(r.maxOccupancy)}</span>
                  {r.bedType && <span className="inline-flex items-center gap-1"><BedDouble className="size-3.5" /> {r.bedType}</span>}
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </section>

      {/* experiences */}
      <section id="experiences" className="relative overflow-hidden bg-ionian-950 py-24 text-limestone-50 md:py-36">
        <div className="bg-qilim pointer-events-none absolute inset-0 opacity-30" />
        <div className="relative mx-auto max-w-7xl px-5 md:px-10">
          <motion.div {...reveal} className="max-w-2xl">
            <p className="text-xs tracking-[0.3em] text-gold-400 uppercase">{t.nav.experiences}</p>
            <h2 className="font-display mt-4 text-5xl md:text-7xl">{t.experiencesTitle}</h2>
            <p className="mt-4 text-lg text-ionian-200">{t.experiencesSub}</p>
          </motion.div>
          <div className="mt-20 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {content.outlets.map((o, i) => {
              const Icon = o.type === 'restaurant' ? Coffee : o.type === 'spa' ? Flower2 : o.type === 'pool_bar' ? Waves : Wine;
              return (
                <motion.div key={o.id} {...reveal} transition={{ ...reveal.transition, delay: i * 0.08 }} className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur transition-colors hover:bg-white/10">
                  <Icon className="size-6 text-gold-400" strokeWidth={1.4} />
                  <h3 className="font-display mt-6 text-3xl">{o.name}</h3>
                  <p className="mt-1 text-xs tracking-wider text-ionian-200 uppercase">{t.outlet[o.type]}</p>
                  {o.hours && <p className="mt-4 text-sm text-ionian-100">{o.hours}</p>}
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* spa */}
      {content.spa.length > 0 && (
        <section id="spa" className="mx-auto max-w-7xl px-5 py-24 md:px-10 md:py-36">
          <motion.div {...reveal} className="max-w-2xl">
            <p className="text-xs tracking-[0.3em] text-accent uppercase">{t.nav.spa}</p>
            <h2 className="font-display mt-4 text-5xl md:text-7xl">{t.spaTitle}</h2>
            <p className="mt-4 text-lg text-limestone-700">{t.spaSub}</p>
          </motion.div>
          <ul className="mt-12 divide-y divide-limestone-200 border-y border-limestone-200">
            {content.spa.map((s) => (
              <motion.li key={s.id} {...reveal} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-5">
                <div className="min-w-0 flex-1">
                  <p className="font-display text-2xl md:text-3xl">{s.name}</p>
                  <p className="mt-1 max-w-xl text-sm text-limestone-700">{s.description}</p>
                </div>
                <p className="text-sm text-limestone-600">{s.durationMin} {t.minutes}</p>
                <p className="font-serif text-2xl tabular-nums">{money(s.price)}</p>
              </motion.li>
            ))}
          </ul>
        </section>
      )}

      {/* contact */}
      <section id="contact" className="bg-limestone-100 py-32 md:py-48">
        <div className="mx-auto grid max-w-7xl gap-14 px-5 md:grid-cols-2 md:px-10">
          <motion.div {...reveal}>
            <p className="text-xs tracking-[0.3em] text-accent uppercase">{t.nav.contact}</p>
            <h2 className="font-display mt-4 text-5xl md:text-6xl">{t.contactTitle}</h2>
            <p className="mt-4 max-w-md text-limestone-700">{t.contactSub}</p>
            <ul className="mt-10 space-y-4 text-sm">
              {address && <li className="flex items-start gap-3"><MapPin className="mt-0.5 size-4 text-accent" /> {address}{city ? `, ${city}` : ''}</li>}
              {phone && <li className="flex items-center gap-3"><Phone className="size-4 text-accent" /> <a href={`tel:${phone.replace(/\s/g, '')}`}>{phone}</a></li>}
              {email && <li className="flex items-center gap-3"><span className="w-4 text-center text-accent">@</span> <a href={`mailto:${email}`}>{email}</a></li>}
            </ul>
          </motion.div>
          <InquiryForm slug={slug} locale={locale} />
        </div>
        <p className="mx-auto mt-20 max-w-7xl px-5 text-xs text-limestone-500 md:px-10">© {new Date().getFullYear()} {name} · {t.poweredBy} Iliria</p>
      </section>

      {/* results sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent closeLabel="×" className="max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{picked ? t.yourDetails : t.results}</SheetTitle>
            <p className="text-sm text-muted">
              {formatDay(checkIn, locale, { day: 'numeric', month: 'short' })} → {formatDay(checkOut, locale, { day: 'numeric', month: 'short' })} · {t.nights(nights)} · {adults + children} {locale === 'en' ? 'guests' : 'persona'}
            </p>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-6">
            {!picked && (
              <ul className="space-y-3">
                {content.types.map((r, i) => {
                  const o = optionOf(r.id);
                  const why = result?.failures[r.id];
                  return (
                    <li key={r.id} className={cn('flex gap-4 rounded-2xl border border-border p-3', !o && 'opacity-55')}>
                      <div className="hidden w-28 shrink-0 overflow-hidden rounded-xl sm:block">
                        {r.images[0] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.images[0]} alt="" className="size-full object-cover" />
                        ) : (
                          <RoomArt seed={i} className="size-full" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-2xl">{r.name}</p>
                        {o ? (
                          <>
                            <p className="mt-1 text-xs text-accent">{t.left(o.available)}</p>
                            <p className="mt-2 font-serif text-3xl tabular-nums">{money(o.total)} <span className="font-sans text-xs text-muted">{t.totalFor} · {money(o.perNight)} / {t.perNight}</span></p>
                            <button type="button" onClick={() => setPicked(r)} className="mt-3 inline-flex h-9 items-center gap-2 rounded-full bg-ionian-900 px-5 text-sm text-limestone-50 transition-transform hover:-translate-y-0.5">{t.choose} <ArrowRight className="size-4" /></button>
                          </>
                        ) : (
                          <p className="mt-2 text-sm text-muted">{why ? (t.errors[why] ?? t.unavailable) : t.unavailable}</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {picked && optionOf(picked.id) && (
              <GuestForm slug={slug} locale={locale} room={picked} option={optionOf(picked.id)!} checkIn={checkIn} checkOut={checkOut} adults={adults} children={children} money={money} onBack={() => setPicked(null)} />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {props.chat}
    </div>
  );
}

function GuestForm({
  slug, locale, room, option, checkIn, checkOut, adults, children, money, onBack,
}: {
  slug: string; locale: string; room: RoomType; option: { total: number; perNight: number; nights: number };
  checkIn: string; checkOut: string; adults: number; children: number; money: (n: number) => string; onBack: () => void;
}) {
  const t = pickResortCopy(locale);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pay, setPay] = useState<'hotel' | 'deposit'>('hotel');

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setError(null);
    start(async () => {
      const res = await createWebBooking({
        slug, locale, checkIn, checkOut, adults, children, roomTypeId: room.id,
        first: f.get('first'), last: f.get('last'), email: f.get('email'), phone: f.get('phone'),
        requests: f.get('requests') || undefined, pay, website: f.get('website') ?? '',
      });
      if (!res.ok) return setError(t.errors[res.error] ?? t.errors.unknown!);
      window.location.assign(res.data.redirect);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-2xl bg-surface-2 p-4">
        <p className="text-xs tracking-wider text-muted uppercase">{t.summary}</p>
        <p className="font-display mt-1 text-2xl">{room.name}</p>
        <p className="mt-1 text-sm text-muted">{t.nights(option.nights)} · {money(option.perNight)} / {t.perNight}</p>
        <p className="mt-2 font-serif text-3xl tabular-nums">{money(option.total)}</p>
      </div>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <div className="grid grid-cols-2 gap-3">
        <input name="first" placeholder={t.first} required className={field} autoComplete="given-name" />
        <input name="last" placeholder={t.last} required className={field} autoComplete="family-name" />
        <input name="email" type="email" placeholder={t.email} required className={cn(field, 'col-span-2')} autoComplete="email" />
        <input name="phone" type="tel" placeholder={t.phone} required className={cn(field, 'col-span-2')} autoComplete="tel" />
        <textarea name="requests" placeholder={t.requests} rows={2} className={cn(field, 'col-span-2 h-auto py-2.5')} />
      </div>
      <div className="grid gap-2">
        {([['hotel', t.payHotel, t.payHotelHint], ['deposit', t.payDeposit, t.payDepositHint]] as const).map(([k, title, hint]) => (
          <button key={k} type="button" onClick={() => setPay(k)} className={cn('flex items-start gap-3 rounded-xl border p-3 text-left transition-colors', pay === k ? 'border-ionian-600 bg-ionian-50' : 'border-border hover:bg-surface-2')}>
            <span className={cn('mt-0.5 grid size-5 place-items-center rounded-full border', pay === k ? 'border-ionian-700 bg-ionian-800 text-white' : 'border-border-strong')}>{pay === k && <Check className="size-3" />}</span>
            <span><span className="block text-sm font-medium">{title}</span><span className="block text-xs text-muted">{hint}</span></span>
          </button>
        ))}
      </div>
      {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onBack} className="h-11 rounded-full px-5 text-sm text-muted hover:bg-surface-2">{t.back}</button>
        <button type="submit" disabled={pending} className="h-11 flex-1 rounded-full bg-ionian-900 text-sm font-medium text-limestone-50 transition-transform hover:-translate-y-0.5 disabled:opacity-60">{pending ? t.confirming : t.confirm}</button>
      </div>
      <p className="text-center text-xs text-subtle">{t.privacy}</p>
    </form>
  );
}

function InquiryForm({ slug, locale }: { slug: string; locale: string }) {
  const t = pickResortCopy(locale);
  const [pending, start] = useTransition();
  const [state, setState] = useState<'idle' | 'sent' | string>('idle');

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    start(async () => {
      const res = await sendInquiry({ slug, locale, name: f.get('name'), email: f.get('email'), message: f.get('message'), website: f.get('website') ?? '' });
      if (!res.ok) return setState(t.errors[res.error] ?? t.errors.unknown!);
      form.reset();
      setState('sent');
    });
  }

  return (
    <motion.form {...reveal} onSubmit={submit} className="space-y-3 rounded-3xl bg-white p-6 shadow-soft md:p-8">
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <input name="name" placeholder={t.name} required className={field} />
      <input name="email" type="email" placeholder={t.email} required className={field} />
      <textarea name="message" placeholder={t.message} rows={4} required minLength={5} className={cn(field, 'h-auto py-2.5')} />
      {state === 'sent' ? <p className="rounded-lg bg-success-soft px-3 py-2 text-sm text-success">{t.sent}</p> : state !== 'idle' && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{state}</p>}
      <button type="submit" disabled={pending} className="h-11 w-full rounded-full bg-ionian-900 text-sm font-medium text-limestone-50 disabled:opacity-60">{t.send}</button>
    </motion.form>
  );
}
