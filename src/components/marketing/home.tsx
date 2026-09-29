'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { motion, useMotionValueEvent, useScroll, useTransform } from 'motion/react';
import { ArrowUpRight, Banknote, CalendarRange, Camera, Check, ChevronDown, Inbox, Network, PhoneCall, QrCode, ShieldAlert, Sparkles, Wine } from 'lucide-react';
import { ADDONS, FOUNDING_HOTELS, foundingPrice, PLAN_PRICE_EUR, type SizeKey } from '@/config/plans';
import { SeaHero } from '@/components/resort/sea-art';
import { AskDemo, FEATURE_PHOTOS, FeatureCard, HOW_PHOTOS, InboxDemo, Interlude, LiveBrief, LiveCalendar, LiveChat, Odometer, Photo, RevealLine } from './live';
import { cn } from '@/lib/utils';
import { pickMarketingCopy } from './copy';

const reveal = { initial: { opacity: 0, y: 30 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-80px' }, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const } };
const ICONS = { ask: Sparkles, calendar: CalendarRange, channels: Network, inbox: Inbox, pos: Wine, fiscal: QrCode, ocr: Camera, voice: PhoneCall, alerts: ShieldAlert } as const;

export function MarketingHome({ locale, whatsapp, email }: { locale: string; whatsapp: string | null; email: string }) {
  const t = pickMarketingCopy(locale);
  const hero = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: hero, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '25%']);
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0]);
  const [open, setOpen] = useState<number | null>(0);
  const [size, setSize] = useState<SizeKey>('small');
  const other = locale === 'en' ? '/' : '/en';
  const { scrollYProgress: pageProgress, scrollY: pageY } = useScroll();
  const [solid, setSolid] = useState(false);
  useMotionValueEvent(pageY, 'change', (v) => { setSolid(v > 60); });

  return (
    <div className="bg-limestone-50 text-ionian-950" data-theme="day">
      <motion.div style={{ scaleX: pageProgress, transformOrigin: '0 50%' }} className="fixed inset-x-0 top-0 z-50 h-0.5 bg-gold-400" />
      <header className={cn('fixed inset-x-0 top-0 z-40 flex items-center justify-between px-5 py-4 text-limestone-50 transition-[background-color,backdrop-filter,padding] duration-500 md:px-10', solid && 'bg-ionian-950/80 py-3 backdrop-blur-xl')}>
        <Link href="/" className="font-display text-2xl drop-shadow">Iliria</Link>
        <nav className="hidden items-center gap-7 text-sm md:flex">
          {(['features', 'how', 'pricing', 'faq'] as const).map((k) => <a key={k} href={`#${k}`} className="opacity-80 drop-shadow hover:opacity-100">{t.nav[k]}</a>)}
          <Link href={other} className="rounded-full border border-white/30 px-3 py-1 text-xs uppercase">{locale === 'en' ? 'SQ' : 'EN'}</Link>
        </nav>
        <Link href="/app" className="rounded-full bg-gold-400 px-5 py-2 text-sm font-semibold text-ionian-950 shadow-lg transition-transform hover:-translate-y-0.5">{t.nav.demo}</Link>
      </header>

      {/* hero */}
      <div ref={hero} className="relative min-h-[100svh] overflow-hidden bg-ionian-950 text-limestone-50">
        <motion.div style={{ y }} className="absolute inset-[-6%]">
          <SeaHero className="size-full" />
          <Photo src="/images/marketing/hero.jpg" alt="" priority className="animate-kenburns absolute inset-0" />
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-b from-ionian-950/70 via-ionian-950/20 to-ionian-950" />
        <div className="absolute inset-0 bg-gradient-to-r from-ionian-950/60 via-transparent to-transparent" />
        <div className="bg-qilim pointer-events-none absolute inset-0 opacity-30" />
        <motion.div style={{ opacity: fade }} className="relative z-10 mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-center px-6 pt-28 pb-16 md:px-10">
          <motion.p initial={{ opacity: 0, letterSpacing: '0.1em' }} animate={{ opacity: 1, letterSpacing: '0.3em' }} transition={{ duration: 1.3 }} className="text-[11px] text-gold-400 uppercase md:text-xs">{t.hero.eyebrow}</motion.p>
          <h1 className="font-display mt-6 text-6xl leading-[0.92] tracking-tight sm:text-7xl md:text-[7rem]">
            {t.hero.title.map((line, i) => (
              <RevealLine key={i} delay={0.25 + i * 0.14} className={cn(i === 2 && 'text-shimmer italic')}>{line}</RevealLine>
            ))}
          </h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1, duration: 1 }} className="mt-8 max-w-xl text-base text-ionian-100 md:text-lg">{t.hero.sub}</motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2, duration: 0.8 }} className="mt-10 flex flex-wrap items-center gap-3">
            <Link href="/app" className="group inline-flex h-13 items-center gap-2 rounded-full bg-gold-400 px-7 py-3.5 text-sm font-semibold text-ionian-950 shadow-float transition-all hover:-translate-y-0.5 hover:bg-gold-500">{t.hero.cta}<ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></Link>
            <Link href="/r/vala" className="inline-flex items-center rounded-full border border-white/25 bg-white/5 px-7 py-3.5 text-sm backdrop-blur transition-colors hover:bg-white/10">{t.hero.cta2}</Link>
          </motion.div>
          <p className="mt-4 text-xs text-ionian-200/80">{t.hero.note}</p>

          <div className="mt-16 grid gap-5 md:grid-cols-3">
            <LiveBrief title={t.cards.brief.title} text={t.cards.brief.text} />
            <LiveChat guest={t.cards.chat.guest} ai={t.cards.chat.ai} locale={locale} />
            <LiveCalendar label={t.cards.calendar} locale={locale} />
          </div>
        </motion.div>
      </div>

      {/* channels marquee */}
      <section className="overflow-hidden border-y border-limestone-200 bg-white py-8" aria-hidden>
        <div className="animate-marquee flex w-max gap-16 whitespace-nowrap font-display text-4xl text-limestone-400 md:text-5xl">
          {[0, 1].map((k) => (
            <div key={k} className="flex gap-16">
              {['Booking.com', 'Airbnb', 'Expedia', 'Agoda', 'WhatsApp', 'Instagram', 'Messenger', 'easyPos', 'Google', 'Paysera'].map((n) => <span key={n} className="transition-colors hover:text-ionian-700">{n} <span className="text-gold-500">✦</span></span>)}
            </div>
          ))}
        </div>
      </section>

      {/* stats */}
      <section className="border-b border-limestone-200 bg-limestone-100">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 py-14 md:grid-cols-4 md:px-10">
          {t.stats.map((s) => (
            <motion.div key={s.label} {...reveal}>
              <p className="font-serif text-6xl tabular-nums text-ionian-800 md:text-7xl"><Odometer value={s.value} suffix={s.suffix} /></p>
              <p className="mt-2 text-sm text-limestone-700">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* features bento */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-24 md:px-10 md:py-32">
        <motion.div {...reveal} className="max-w-2xl">
          <p className="text-xs tracking-[0.3em] text-accent uppercase">{t.features.eyebrow}</p>
          <h2 className="font-display mt-4 text-5xl md:text-7xl">{t.features.title}</h2>
        </motion.div>
        <div className="mt-20 grid gap-8 md:grid-cols-3">
          {t.features.items.map((f, i) => {
            const Icon = ICONS[f.key as keyof typeof ICONS];
            return (
              <FeatureCard key={f.key} index={i} big={'big' in f && !!f.big} photo={FEATURE_PHOTOS[f.key] ?? '/images/marketing/exterior-day.jpg'} icon={<Icon className="size-5" strokeWidth={1.5} />} title={f.title} text={f.text}>
                {f.key === 'ask' && <AskDemo locale={locale} />}
                {f.key === 'inbox' && <InboxDemo locale={locale} />}
              </FeatureCard>
            );
          })}
        </div>
      </section>

      {/* how */}
      <section id="how" className="bg-ionian-950 py-24 text-limestone-50 md:py-32">
        <div className="mx-auto max-w-6xl px-6 md:px-10">
          <motion.div {...reveal} className="max-w-2xl">
            <p className="text-xs tracking-[0.3em] text-gold-400 uppercase">{t.how.eyebrow}</p>
            <h2 className="font-display mt-4 text-5xl md:text-7xl">{t.how.title}</h2>
          </motion.div>
          <div className="mt-20 grid gap-8 md:grid-cols-3">
            {t.how.steps.map((s, i) => (
              <motion.div key={s.n} {...reveal} transition={{ ...reveal.transition, delay: i * 0.12 }} className="group overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-9">
                <div className="-mx-9 -mt-9 mb-8 aspect-[4/3] overflow-hidden">
                  <Photo reveal src={HOW_PHOTOS[i] ?? '/images/marketing/exterior-day.jpg'} alt="" sizes="(min-width:768px) 33vw, 100vw" className="size-full transition-transform duration-[1600ms] group-hover:scale-105" />
                </div>
                <p className="font-serif text-7xl text-gold-400/90">{s.n}</p>
                <h3 className="font-display mt-4 text-3xl">{s.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-ionian-200">{s.text}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <Interlude locale={locale} />

      {/* pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-24 md:px-10 md:py-32">
        <motion.div {...reveal} className="max-w-2xl">
          <p className="text-xs tracking-[0.3em] text-accent uppercase">{t.pricing.eyebrow}</p>
          <h2 className="font-display mt-4 text-5xl md:text-7xl">{t.pricing.title}</h2>
          <p className="mt-4 text-lg text-limestone-700">{t.pricing.sub}</p>
        </motion.div>
        <div className="mt-10 flex flex-wrap items-center gap-3">
          <span className="text-sm text-limestone-700">{t.pricing.sizeLabel}</span>
          {(['small', 'medium', 'large'] as const).map((k) => <button key={k} type="button" onClick={() => setSize(k)} className={cn('h-10 rounded-full border px-5 text-sm transition-colors', size === k ? 'border-transparent bg-ionian-900 text-limestone-50' : 'border-limestone-300 hover:bg-limestone-100')}>{t.pricing.sizes[k]}</button>)}
        </div>
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-gold-100 px-4 py-1.5 text-xs font-medium text-limestone-800"><Sparkles className="size-3.5 text-accent" />{t.pricing.founding(FOUNDING_HOTELS)}</p>
        <div className="mt-8 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {t.pricing.plans.map((p, i) => {
            const list = p.key === 'enterprise' ? null : PLAN_PRICE_EUR[p.key as 'basic' | 'pro' | 'premium'][size];
            return (
              <motion.div key={p.key} {...reveal} transition={{ ...reveal.transition, delay: i * 0.08 }} className={cn('relative flex flex-col rounded-3xl border p-6', 'popular' in p && p.popular ? 'border-transparent bg-ionian-900 text-limestone-50 shadow-float lg:-translate-y-3' : 'border-limestone-200 bg-white')}>
                {'popular' in p && p.popular && <span className="absolute -top-3 left-6 rounded-full bg-gold-400 px-3 py-1 text-[11px] font-semibold text-ionian-950">{t.pricing.popular}</span>}
                <h3 className="font-display text-3xl">{p.name}</h3>
                <p className="mt-1 text-sm opacity-70">{p.text}</p>
                {list ? (
                  <p className="font-serif mt-5 text-5xl tabular-nums">{foundingPrice(list)} €<span className="font-sans text-sm opacity-60"> {t.pricing.per}</span><span className="mt-1 block font-sans text-xs opacity-60">{t.pricing.was}: <s>{list} €</s></span></p>
                ) : (
                  <p className="font-serif mt-5 text-3xl leading-tight">{t.pricing.enterpriseFrom}</p>
                )}
                <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                  {p.features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-gold-500" />{f}</li>)}
                </ul>
                <a href="#contact" className={cn('mt-8 grid h-11 place-items-center rounded-full text-sm font-medium transition-transform hover:-translate-y-0.5', 'popular' in p && p.popular ? 'bg-gold-400 text-ionian-950' : 'bg-ionian-900 text-limestone-50')}>{list ? t.pricing.cta : t.pricing.contact}</a>
              </motion.div>
            );
          })}
        </div>
        <div className="mt-10 grid gap-3 md:grid-cols-3">
          <h3 className="font-display text-3xl md:col-span-3">{t.pricing.addonsTitle}</h3>
          {t.pricing.addons.map((a) => (
            <div key={a.name} className="rounded-2xl border border-limestone-200 bg-white p-5"><p className="font-medium">{a.name}</p><p className="mt-1 text-sm text-limestone-700">{a.text}</p><p className="font-serif mt-3 text-2xl">{a.price || `${ADDONS.realtimeSync[size]} € / ${locale === 'en' ? 'month' : 'muaj'}`}</p></div>
          ))}
        </div>
        <p className="mt-6 flex items-center gap-2 text-xs text-limestone-600"><Banknote className="size-4" /> {t.pricing.note}</p>
      </section>

      {/* faq */}
      <section id="faq" className="bg-limestone-100 py-32 md:py-48">
        <div className="mx-auto max-w-3xl px-6 md:px-10">
          <motion.div {...reveal}>
            <p className="text-xs tracking-[0.3em] text-accent uppercase">{t.faq.eyebrow}</p>
            <h2 className="font-display mt-4 text-5xl md:text-6xl">{t.faq.title}</h2>
          </motion.div>
          <div className="mt-10 divide-y divide-limestone-300 border-y border-limestone-300">
            {t.faq.items.map((f, i) => (
              <div key={f.q}>
                <button type="button" onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-center justify-between gap-4 py-5 text-left"><span className="font-display text-2xl">{f.q}</span><ChevronDown className={cn('size-5 shrink-0 transition-transform', open === i && 'rotate-180')} /></button>
                <motion.div initial={false} animate={{ height: open === i ? 'auto' : 0, opacity: open === i ? 1 : 0 }} className="overflow-hidden"><p className="pb-5 text-limestone-700">{f.a}</p></motion.div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* contact */}
      <section id="contact" className="relative overflow-hidden bg-ionian-950 py-24 text-limestone-50 md:py-32">
        <div className="bg-qilim pointer-events-none absolute inset-0 opacity-25" />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-6 md:grid-cols-2 md:px-10">
          <motion.div {...reveal}>
            <h2 className="font-display text-5xl md:text-7xl">{t.cta.title}</h2>
            <p className="mt-5 max-w-md text-ionian-200">{t.cta.sub}</p>
            <p className="mt-8 text-xs tracking-wider text-ionian-200 uppercase">{t.cta.or}</p>
            <div className="mt-3 flex flex-wrap gap-3 text-sm">
              {whatsapp && <a href={`https://wa.me/${whatsapp.replace(/\D/g, '')}`} className="rounded-full bg-[#2FA36B] px-5 py-2.5 font-medium text-white">{t.cta.whatsapp}</a>}
              <a href={`mailto:${email}`} className="rounded-full border border-white/25 px-5 py-2.5">{email}</a>
            </div>
          </motion.div>
          <LeadForm t={t} locale={locale} />
        </div>
        <p className="relative mx-auto mt-20 flex max-w-6xl flex-wrap justify-between gap-2 px-6 text-xs text-ionian-200/70 md:px-10"><span>© {new Date().getFullYear()} Iliria · {t.footer.made}</span><span className="space-x-4"><Link href="/r/vala">{t.footer.resort}</Link><Link href="/login">{t.footer.login}</Link></span></p>
      </section>
    </div>
  );
}

function LeadForm({ t, locale }: { t: ReturnType<typeof pickMarketingCopy>; locale: string }) {
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'error'>('idle');
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setState('busy');
    const res = await fetch('/api/lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: f.get('name'), hotel: f.get('hotel'), phone: f.get('phone'), website: f.get('website') ?? '', locale }) }).catch(() => null);
    setState(res?.ok ? 'sent' : 'error');
  }
  const field = 'h-12 w-full rounded-xl border border-white/15 bg-white/8 px-4 text-sm text-limestone-50 outline-none placeholder:text-ionian-200/60 focus:border-gold-400';
  return (
    <motion.form {...reveal} onSubmit={submit} className="space-y-3 rounded-3xl border border-white/15 bg-white/8 p-6 backdrop-blur-xl md:p-8">
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      <input name="name" placeholder={t.cta.name} required minLength={2} className={field} />
      <input name="hotel" placeholder={t.cta.hotel} required minLength={2} className={field} />
      <input name="phone" placeholder={t.cta.phone} required minLength={6} className={field} />
      {state === 'sent' && <p className="rounded-lg bg-olive-500/25 px-3 py-2 text-sm">{t.cta.sent}</p>}
      {state === 'error' && <p className="rounded-lg bg-terracotta-500/30 px-3 py-2 text-sm">{t.cta.error}</p>}
      <button type="submit" disabled={state === 'busy' || state === 'sent'} className="h-12 w-full rounded-full bg-gold-400 text-sm font-semibold text-ionian-950 transition-transform hover:-translate-y-0.5 disabled:opacity-60">{t.cta.send}</button>
    </motion.form>
  );
}
