'use client';

import { motion, useScroll, useTransform } from 'motion/react';
import { ArrowRight, ArrowUpRight, CalendarRange, Check, Globe, Inbox, Network, PhoneCall, QrCode, ShieldAlert, Sparkles, SprayCan, TrendingUp, UserRound, Wallet, Wine, type LucideIcon } from 'lucide-react';
import { useRef } from 'react';
import { foundingPrice, PLAN_NAMES, PLAN_PRICE_EUR, SETUP_FEE_EUR } from '@/config/plans';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import { Ambient } from './ambient';
import { LiveChat, Photo, RevealLine } from './live';
import { PROPERTY, PROPERTY_PHOTOS, PROPERTY_TYPES, SHARED, type FeatureIcon, type PropertyType } from './property-copy';
import { SiteHeader } from './site-header';

const ICONS: Record<FeatureIcon, LucideIcon> = {
  calendar: CalendarRange, channels: Network, inbox: Inbox, pos: Wine, fiscal: QrCode, ask: Sparkles, profile: UserRound, book: Globe,
  voice: PhoneCall, alerts: ShieldAlert, housekeeping: SprayCan, reports: TrendingUp, expenses: Wallet,
};
const EASE = [0.22, 1, 0.36, 1] as const;
const reveal = { initial: { opacity: 0, y: 32 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-80px' }, transition: { duration: 0.9, ease: EASE } };

const lang = (locale: string) => (locale === 'en' ? 'en' : 'sq');

/** Photo cards linking to each property page. Used on the home page and at the bottom of every property page. */
export function PropertyCards({ locale, exclude, className }: { locale: string; exclude?: PropertyType; className?: string }) {
  const l = lang(locale);
  const list = PROPERTY_TYPES.filter((k) => k !== exclude);
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2', list.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3', className)}>
      {list.map((k, i) => {
        const c = PROPERTY[l][k];
        return (
          <motion.div key={k} {...reveal} transition={{ ...reveal.transition, delay: i * 0.08 }}>
            <Link href={`/for/${k}`} className="group relative isolate flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-[28px] p-6 text-limestone-50 sm:aspect-[3/4]">
              <Photo src={PROPERTY_PHOTOS[k].card} alt="" sizes="(min-width:1024px) 25vw, (min-width:640px) 50vw, 100vw" className="absolute inset-0 -z-10 transition-transform duration-[1600ms] ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-105 group-active:scale-105" />
              <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ionian-950 via-ionian-950/50 to-ionian-950/0" />
              <span className="font-mono text-[10px] tracking-[0.18em] text-gold-400 uppercase">{c.place}</span>
              <h3 className="font-display mt-2 text-3xl">{c.name}</h3>
              <p className="mt-2 text-sm text-limestone-100/85">{c.cardText}</p>
              <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium">
                {SHARED[l].types.open}
                <span className="grid size-8 place-items-center rounded-full border border-white/30 transition-all duration-500 group-hover:border-gold-400 group-hover:bg-gold-400 group-hover:text-ionian-950"><ArrowUpRight className="size-4" /></span>
              </span>
            </Link>
          </motion.div>
        );
      })}
    </div>
  );
}

export function PropertyPage({ locale, type, whatsapp }: { locale: string; type: PropertyType; whatsapp: string | null }) {
  const l = lang(locale);
  const c = PROPERTY[l][type];
  const s = SHARED[l].common;
  const hero = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: hero, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '18%']);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, 0.2]);
  const list = PLAN_PRICE_EUR[c.fit.plan][c.fit.size];
  const price = foundingPrice(list);

  return (
    <div className="bg-limestone-50 text-ionian-950" data-theme="day">
      <Ambient />
      <SiteHeader locale={locale} />

      {/* hero */}
      <div ref={hero} className="relative isolate flex min-h-[100svh] flex-col justify-end overflow-hidden bg-ionian-950 text-limestone-50">
        <motion.div style={{ y }} className="absolute inset-[-4%] -z-10">
          <Photo src={PROPERTY_PHOTOS[type].hero} alt="" priority position={type === 'resort' ? '28% 50%' : '50% 50%'} className="animate-kenburns absolute inset-0" />
        </motion.div>
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ionian-950 via-ionian-950/55 to-ionian-950/25" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ionian-950/70 via-ionian-950/10 to-transparent" />
        <motion.div style={{ opacity: fade }} className="mx-auto w-full max-w-6xl px-6 pt-32 pb-12 md:px-10 md:pb-16">
          <Link href="/#types" className="inline-flex items-center gap-2 text-xs tracking-[0.18em] text-limestone-100/80 uppercase transition-colors hover:text-gold-400">
            <ArrowRight className="size-3.5 rotate-180" />{s.back}
          </Link>
          <motion.p initial={{ opacity: 0, letterSpacing: '0.1em' }} animate={{ opacity: 1, letterSpacing: '0.3em' }} transition={{ duration: 1.3 }} className="mt-6 text-[11px] text-gold-400 uppercase md:text-xs">{c.eyebrow} · {c.place}</motion.p>
          <h1 className="font-display mt-5 text-5xl leading-[0.98] sm:text-6xl md:text-[5.5rem]">
            <RevealLine delay={0.2}>{c.title[0]}</RevealLine>
            <RevealLine delay={0.34} className="text-shimmer italic">{c.title[1]}</RevealLine>
          </h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9, duration: 1 }} className="mt-6 max-w-2xl text-base text-limestone-100/90 md:text-lg">{c.sub}</motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1, duration: 0.8 }} className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/app" className="group inline-flex h-13 items-center gap-2 rounded-full bg-gold-400 px-7 py-3.5 text-sm font-semibold text-ionian-950 shadow-float transition-all hover:-translate-y-0.5 hover:bg-gold-500">{s.demo}<ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></Link>
            <Link href="/#contact" className="inline-flex items-center rounded-full border border-white/25 bg-white/5 px-7 py-3.5 text-sm backdrop-blur transition-colors hover:bg-white/10">{s.talk}</Link>
          </motion.div>
          <motion.dl initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.3, duration: 1, ease: EASE }} className="glass-card mt-10 grid divide-y divide-white/10 rounded-2xl sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {c.stats.map((st) => (
              <div key={st.label} className="px-5 py-4">
                <dt className="font-serif text-3xl text-gold-400 tabular-nums md:text-4xl">{st.value}</dt>
                <dd className="mt-1 text-xs text-limestone-100/80 md:text-sm">{st.label}</dd>
              </div>
            ))}
          </motion.dl>
        </motion.div>
      </div>

      {/* pains */}
      <section className="mx-auto max-w-6xl px-6 py-24 md:px-10 md:py-32">
        <motion.h2 {...reveal} className="font-display max-w-3xl text-4xl md:text-6xl">{c.painsTitle}</motion.h2>
        <div className="mt-12 divide-y divide-limestone-200 border-y border-limestone-200">
          {c.pains.map((p, i) => (
            <motion.div key={p.pain} {...reveal} transition={{ ...reveal.transition, delay: i * 0.06 }} className="grid gap-4 py-8 md:grid-cols-[1fr_auto_1.15fr] md:items-center md:gap-10">
              <div>
                <p className="font-mono text-[10px] tracking-[0.2em] text-limestone-500 uppercase">{s.painLabel}</p>
                <p className="mt-2 text-lg text-limestone-700 md:text-xl">{p.pain}</p>
              </div>
              <span className="hidden size-10 place-items-center rounded-full border border-limestone-300 text-accent md:grid"><ArrowRight className="size-4" /></span>
              <div className="rounded-2xl bg-ionian-950 p-5 text-limestone-50 md:p-6">
                <p className="font-mono text-[10px] tracking-[0.2em] text-gold-400 uppercase">{s.fixLabel}</p>
                <p className="mt-2 text-base leading-relaxed md:text-lg">{p.fix}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* features */}
      <section className="bg-limestone-100 py-24 md:py-32">
        <div className="mx-auto max-w-6xl px-6 md:px-10">
          <motion.h2 {...reveal} className="font-display max-w-3xl text-4xl md:text-6xl">{c.featuresTitle}</motion.h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {c.features.map((f, i) => {
              const Icon = ICONS[f.icon];
              return (
                <motion.article key={f.title} {...reveal} transition={{ ...reveal.transition, delay: (i % 3) * 0.07 }} className="group relative overflow-hidden rounded-[24px] border border-limestone-200 bg-white p-6 transition-all duration-500 hover:-translate-y-1 hover:border-gold-400/50 hover:shadow-lift active:scale-[0.99]">
                  <div className="grid size-11 place-items-center rounded-full border border-limestone-300 text-ionian-700 transition-colors duration-500 group-hover:border-gold-400 group-hover:bg-gold-400 group-hover:text-ionian-950"><Icon className="size-5" strokeWidth={1.5} /></div>
                  <h3 className="font-display mt-6 text-2xl">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-limestone-700">{f.text}</p>
                  <span className="absolute inset-x-6 bottom-0 h-px origin-left scale-x-0 bg-gold-400 transition-transform duration-700 group-hover:scale-x-100" />
                </motion.article>
              );
            })}
          </div>
        </div>
      </section>

      {/* live chat scene */}
      <section className="relative overflow-hidden bg-ionian-950 py-24 text-limestone-50 md:py-32">
        <div className="bg-qilim pointer-events-none absolute inset-0 opacity-20" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 md:grid-cols-2 md:gap-20 md:px-10">
          <motion.div {...reveal}>
            <p className="text-xs tracking-[0.3em] text-gold-400 uppercase">AI</p>
            <h2 className="font-display mt-4 text-4xl md:text-6xl">{c.chat.title}</h2>
            <p className="mt-5 max-w-md text-ionian-200">{c.chat.sub}</p>
          </motion.div>
          <LiveChat guest={c.chat.guest} ai={c.chat.ai} locale={locale} />
        </div>
      </section>

      {/* fit + price */}
      <section className="mx-auto max-w-6xl px-6 py-24 md:px-10 md:py-32">
        <motion.div {...reveal} className="grid overflow-hidden rounded-[32px] border border-limestone-200 bg-white md:grid-cols-[0.8fr_1.2fr]">
          <div className="relative aspect-[4/3] md:aspect-auto">
            <Photo reveal src="/images/platform/detail-welcome.jpg" alt="" sizes="(min-width:768px) 40vw, 100vw" className="absolute inset-0" />
            <div className="absolute inset-0 bg-gradient-to-t from-ionian-950/60 to-transparent" />
            <p className="font-display absolute bottom-5 left-6 text-4xl text-limestone-50 italic">{s.welcome}</p>
          </div>
          <div className="p-7 md:p-12">
            <p className="text-xs tracking-[0.3em] text-accent uppercase">{c.fit.rooms}</p>
            <h2 className="font-display mt-3 text-3xl md:text-5xl">{c.fit.title}</h2>
            <div className="mt-8 flex flex-wrap items-end gap-x-8 gap-y-4">
              <div>
                <p className="text-xs text-limestone-600">{s.plan}: {PLAN_NAMES[c.fit.plan]}</p>
                <p className="font-serif text-6xl tabular-nums md:text-7xl">{price} €<span className="font-sans text-sm text-limestone-600"> {s.perMonth}</span></p>
                <p className="mt-1 text-xs text-limestone-600"><s>{list} €</s> · {s.foundingNote}</p>
              </div>
              <div className="text-sm text-limestone-700">
                <p>{s.setup}: {SETUP_FEE_EUR[c.fit.size]} €</p>
                <p className="text-xs text-limestone-500">{s.sizes[c.fit.size]}</p>
              </div>
            </div>
            <p className="mt-6 flex gap-2 text-sm leading-relaxed text-limestone-700"><Check className="mt-0.5 size-4 shrink-0 text-gold-500" />{c.fit.why}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/#pricing" className="inline-flex h-12 items-center rounded-full bg-ionian-900 px-6 text-sm font-medium text-limestone-50 transition-transform hover:-translate-y-0.5">{s.seePricing}</Link>
              <Link href="/app" className="inline-flex h-12 items-center rounded-full border border-limestone-300 px-6 text-sm transition-colors hover:bg-limestone-100">{s.demo}</Link>
            </div>
          </div>
        </motion.div>
      </section>

      {/* other types */}
      <section className="mx-auto max-w-6xl px-6 pb-24 md:px-10 md:pb-32">
        <motion.h2 {...reveal} className="font-display text-3xl md:text-5xl">{s.otherTypes}</motion.h2>
        <PropertyCards locale={locale} exclude={type} className="mt-10" />
      </section>

      {/* cta */}
      <section className="relative isolate overflow-hidden bg-ionian-950 py-28 text-limestone-50 md:py-40">
        <Photo src="/images/platform/team.jpg" alt="" className="absolute inset-0 -z-10 opacity-60" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-ionian-950 via-ionian-950/70 to-ionian-950/40" />
        <motion.div {...reveal} className="mx-auto max-w-4xl px-6 text-center md:px-10">
          <h2 className="font-display text-4xl md:text-7xl">{s.ctaTitle}</h2>
          <p className="mx-auto mt-6 max-w-2xl text-ionian-100">{s.ctaSub}</p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link href="/app" className="group inline-flex h-13 items-center gap-2 rounded-full bg-gold-400 px-8 py-3.5 text-sm font-semibold text-ionian-950 shadow-float transition-all hover:-translate-y-0.5 hover:bg-gold-500">{s.demo}<ArrowUpRight className="size-4" /></Link>
            <Link href="/#contact" className="inline-flex items-center rounded-full border border-white/25 bg-white/5 px-8 py-3.5 text-sm backdrop-blur transition-colors hover:bg-white/10">{s.talk}</Link>
            {whatsapp && <a href={`https://wa.me/${whatsapp.replace(/\D/g, '')}`} className="inline-flex items-center rounded-full bg-[#2FA36B] px-8 py-3.5 text-sm font-medium text-white">WhatsApp</a>}
          </div>
        </motion.div>
        <p className="mx-auto mt-20 flex max-w-6xl flex-wrap justify-between gap-2 px-6 text-xs text-ionian-200/70 md:px-10"><span>© {new Date().getFullYear()} Iliria</span><Link href="/">{locale === 'en' ? 'Home' : 'Kryefaqja'}</Link></p>
      </section>
    </div>
  );
}
