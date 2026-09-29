'use client';

import Image from 'next/image';
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useInView, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { CheckCheck, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export const EASE = [0.22, 1, 0.36, 1] as const;
const IMG = '/images/marketing';

export const FEATURE_PHOTOS: Record<string, string> = {
  ask: `${IMG}/owner.jpg`, calendar: `${IMG}/reception.jpg`, channels: `${IMG}/exterior-day.jpg`,
  inbox: `${IMG}/guest-phone.jpg`, pos: `${IMG}/pool-bar.jpg`, fiscal: `${IMG}/restaurant.jpg`,
  ocr: `${IMG}/back-office.jpg`, voice: `${IMG}/room-seaview.jpg`, alerts: `${IMG}/night.jpg`,
};
export const HOW_PHOTOS = [`${IMG}/exterior-day.jpg`, `${IMG}/back-office.jpg`, `${IMG}/owner.jpg`];

/* ─── primitives ─────────────────────────────────────────── */

export function Photo({ src, alt, className, priority, sizes = '100vw', reveal }: { src: string; alt: string; className?: string; priority?: boolean; sizes?: string; reveal?: boolean }) {
  const [failed, setFailed] = useState(false);
  const inner = failed
    ? <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_70%_20%,var(--color-ionian-600),var(--color-ionian-950))]" />
    : <Image src={src} alt={alt} fill priority={priority} sizes={sizes} onError={() => setFailed(true)} className="object-cover" />;
  if (!reveal) return <div className={cn('relative overflow-hidden', className)}>{inner}</div>;
  return (
    <motion.div initial={{ clipPath: 'inset(100% 0 0 0)' }} whileInView={{ clipPath: 'inset(0% 0 0 0)' }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 1.4, ease: EASE }} className={cn('relative overflow-hidden', className)}>
      {inner}
    </motion.div>
  );
}

/** Masked line rise — replaces the blur-in. */
export function RevealLine({ children, delay = 0, className, onView }: { children: ReactNode; delay?: number; className?: string; onView?: boolean }) {
  const anim = { y: '0%', rotate: 0 };
  return (
    <span className="block overflow-hidden pb-[0.06em]">
      <motion.span
        initial={{ y: '110%', rotate: 2 }}
        {...(onView ? { whileInView: anim, viewport: { once: true, margin: '-80px' } } : { animate: anim })}
        transition={{ delay, duration: 1.2, ease: EASE }}
        className={cn('block origin-bottom-left', className)}
      >{children}</motion.span>
    </span>
  );
}

/** Rolling odometer digits — replaces the count-up. */
export function Odometer({ value, suffix = '' }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-60px' });
  const digits = String(value).split('');
  return (
    <span ref={ref} className="inline-flex items-baseline tabular-nums" aria-label={`${value}${suffix}`}>
      {digits.map((d, i) => (
        <span key={i} aria-hidden className="relative inline-block h-[1em] overflow-hidden leading-none">
          <motion.span className="flex flex-col" initial={{ y: '0%' }} animate={inView ? { y: `-${(10 + Number(d)) * 5}%` } : {}} transition={{ duration: 1.8 + i * 0.25, delay: i * 0.08, ease: EASE }}>
            {Array.from({ length: 20 }, (_, n) => <span key={n} className="h-[1em] leading-none">{n % 10}</span>)}
          </motion.span>
        </span>
      ))}
      <span aria-hidden>{suffix}</span>
    </span>
  );
}

/** Word-by-word stream. Layout is reserved up front, so nothing jumps. No cursor. */
export function Stream({ text, start, speed = 55, onDone }: { text: string; start: boolean; speed?: number; onDone?: () => void }) {
  const reduce = useReducedMotion();
  const words = text.split(' ');
  const [n, setN] = useState(0);
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; }, [onDone]);
  useEffect(() => {
    if (!start) return;
    if (reduce) { setN(words.length); done.current?.(); return; }
    if (n >= words.length) { done.current?.(); return; }
    const t = setTimeout(() => setN((x) => x + 1), speed);
    return () => clearTimeout(t);
  }, [start, n, words.length, speed, reduce]);
  return (
    <span>
      {words.map((w, i) => (
        <motion.span key={i} initial={{ opacity: 0, filter: 'blur(4px)' }} animate={i < n ? { opacity: 1, filter: 'blur(0px)' } : {}} transition={{ duration: 0.35 }}>{w} </motion.span>
      ))}
    </span>
  );
}

function useStart(delayMs = 0) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const [go, setGo] = useState(false);
  useEffect(() => {
    if (!inView) return;
    const t = setTimeout(() => setGo(true), delayMs);
    return () => clearTimeout(t);
  }, [inView, delayMs]);
  return [ref, go] as const;
}

function Glass({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4 + delay, duration: 1, ease: EASE }} className="glass-card relative overflow-hidden rounded-2xl p-5">
      {children}
    </motion.div>
  );
}

/* ─── hero demos ─────────────────────────────────────────── */

export function LiveBrief({ title, text }: { title: string; text: string }) {
  const [ref, go] = useStart(1800);
  const lines = text.split(/(?<=[.!?])\s+/);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!go || n >= lines.length) return;
    const t = setTimeout(() => setN((x) => x + 1), n === 0 ? 0 : 1400);
    return () => clearTimeout(t);
  }, [go, n, lines.length]);
  return (
    <Glass>
      <div ref={ref}>
        <div className="flex items-center justify-between text-[11px] tracking-[0.2em] uppercase">
          <span className="flex items-center gap-1.5 text-gold-400"><Sparkles className="size-3.5" />{title}</span>
          <span className="font-mono tracking-normal text-ionian-200/70">06:30</span>
        </div>
        <div className="mt-4 space-y-2.5">
          {lines.map((l, i) => (
            <div key={i} className="relative pl-4">
              <motion.span initial={{ scaleY: 0 }} animate={i < n ? { scaleY: 1 } : {}} transition={{ duration: 0.6, ease: EASE }} className="absolute top-1 bottom-1 left-0 w-px origin-top bg-gold-400/70" />
              <p className="font-serif text-[17px] leading-snug text-limestone-50"><Stream text={l} start={i < n} speed={45} /></p>
            </div>
          ))}
        </div>
      </div>
    </Glass>
  );
}

export function LiveChat({ guest, ai, locale }: { guest: string; ai: string; locale: string }) {
  const [ref, go] = useStart(2200);
  const [phase, setPhase] = useState(0);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!go) return;
    const ts = [setTimeout(() => setPhase(1), 0), setTimeout(() => setPhase(2), 1100), setTimeout(() => setPhase(3), 2600)];
    return () => { ts.forEach(clearTimeout); };
  }, [go]);
  return (
    <Glass delay={0.1}>
      <div ref={ref} className="flex min-h-[190px] flex-col gap-2">
        <div className="mb-1 flex items-center gap-2 text-[11px] tracking-[0.2em] text-ionian-200 uppercase">
          <span className="size-2 rounded-full" style={{ background: 'var(--color-ch-whatsapp)' }} />WhatsApp · Marco R.
          <span className="ml-auto font-mono tracking-normal normal-case text-ionian-200/60">09:12</span>
        </div>
        <AnimatePresence>
          {phase >= 1 && <motion.p initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.6, ease: EASE }} className="ml-auto max-w-[88%] rounded-2xl rounded-br-md bg-white/15 px-3.5 py-2 text-sm">{guest}</motion.p>}
        </AnimatePresence>
        {phase === 2 && <div className="typing-dots w-fit rounded-2xl rounded-bl-md bg-white/10 px-3.5 py-3 text-limestone-50"><span /><span /><span /></div>}
        {phase >= 3 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="ai-glow max-w-[92%] rounded-2xl rounded-bl-md px-3.5 py-2 text-sm text-ionian-950">
            <Stream text={ai} start speed={60} onDone={() => setDone(true)} />
          </motion.div>
        )}
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: done ? 1 : 0 }} transition={{ duration: 0.6 }} className="mt-auto flex items-center gap-1 text-[11px] text-ionian-200/80">
          <CheckCheck className="size-3.5 text-gold-400" />
          {locale === 'en' ? 'Answered by AI in 4s · availability checked' : 'U përgjigj AI në 4s · disponueshmëria u kontrollua'}
        </motion.p>
      </div>
    </Glass>
  );
}

const ROWS = [
  { room: '101', b: [{ s: 0, w: 3, c: 'var(--color-ch-booking)', n: 'Marco R.' }] },
  { room: '102', b: [{ s: 1, w: 4, c: 'var(--color-ch-airbnb)', n: 'Jonas W.' }] },
  { room: '201', b: [{ s: 0, w: 2, c: 'var(--color-ch-whatsapp)', n: 'Blerim K.' }, { s: 3, w: 3, c: 'var(--color-ch-booking)', n: 'Sofia G.' }] },
];
const FREE_BEFORE = [1, 0, 1, 1, 1, 2, 3];
const FREE_AFTER = [1, 0, 1, 1, 0, 1, 3];
const CHANNELS = [{ k: 'B', c: 'var(--color-ch-booking)' }, { k: 'A', c: 'var(--color-ch-airbnb)' }, { k: 'E', c: '#1f3b73' }];

export function LiveCalendar({ label, locale }: { label: string; locale: string }) {
  const en = locale === 'en';
  const [ref, go] = useStart(2600);
  const [placed, setPlaced] = useState(false);
  const [synced, setSynced] = useState(false);
  useEffect(() => {
    if (!go) return;
    const a = setTimeout(() => setPlaced(true), 1100);
    const b = setTimeout(() => setSynced(true), 2100);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [go]);
  const free = placed ? FREE_AFTER : FREE_BEFORE;
  const chip = (cls?: string) => (
    <motion.div layoutId="elira-chip" transition={{ type: 'spring', stiffness: 130, damping: 20 }} className={cn('flex h-6 items-center rounded px-2 text-[10px] font-medium text-white shadow-lg', cls)} style={{ background: 'var(--color-ch-direct)' }}>Elira K.</motion.div>
  );
  return (
    <Glass delay={0.2}>
      <div ref={ref}>
        <div className="flex items-center justify-between text-[11px] tracking-[0.2em] text-ionian-200 uppercase">
          <span>{label}</span>
          <span className="flex items-center gap-1.5 font-mono tracking-normal"><span className="size-1.5 animate-pulse rounded-full bg-gold-400" />live</span>
        </div>
        <div className="mt-4 grid grid-cols-[34px_1fr] gap-y-1.5 text-[10px]">
          <span />
          <div className="grid grid-cols-7 text-center font-mono text-ionian-200/60">{[14, 15, 16, 17, 18, 19, 20].map((d) => <span key={d}>{d}</span>)}</div>
          {ROWS.map((r, ri) => (
            <Fragment key={r.room}>
              <span className="self-center font-mono text-ionian-200/70">{r.room}</span>
              <div className="relative h-7 rounded bg-white/[0.04] bg-[linear-gradient(90deg,rgba(255,255,255,.06)_1px,transparent_1px)] bg-[length:calc(100%/7)_100%]">
                {r.b.map((b, j) => (
                  <motion.div key={j} initial={{ clipPath: 'inset(0 100% 0 0)' }} animate={go ? { clipPath: 'inset(0 0% 0 0)' } : {}} transition={{ delay: ri * 0.12 + j * 0.15, duration: 0.9, ease: EASE }} style={{ left: `${(b.s / 7) * 100}%`, width: `calc(${(b.w / 7) * 100}% - 3px)`, background: b.c }} className="absolute inset-y-0.5 flex items-center rounded px-2 font-medium text-white">{b.n}</motion.div>
                ))}
                {ri === 0 && placed && <div className="absolute inset-y-0.5" style={{ left: `${(4 / 7) * 100}%`, width: `calc(${(2 / 7) * 100}% - 3px)` }}>{chip('h-full w-full')}</div>}
              </div>
            </Fragment>
          ))}
          <span className="self-center text-ionian-200/50">{en ? 'Free' : 'Lira'}</span>
          <div className="grid grid-cols-7 text-center font-mono">
            {free.map((f, i) => <motion.span key={`${i}-${f}`} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className={f === 0 ? 'text-terracotta-400' : 'text-limestone-100'}>{f}</motion.span>)}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
          <div className="flex h-7 items-center gap-2 text-[10px] text-ionian-200/60">
            {!placed ? <><span>{en ? 'Unassigned' : 'Pa dhomë'}</span>{chip()}</> : <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{synced ? (en ? 'Channels updated' : 'Kanalet u përditësuan') : (en ? 'Room 101 assigned' : 'U caktua dhoma 101')}</motion.span>}
          </div>
          <div className="flex gap-1.5">
            {CHANNELS.map((c, i) => <span key={c.k} className={cn('relative grid size-6 place-items-center rounded-full text-[9px] font-semibold text-white', synced && 'channel-ping')} style={{ background: c.c, animationDelay: `${i * 120}ms` }}>{c.k}</span>)}
          </div>
        </div>
      </div>
    </Glass>
  );
}

/* ─── feature cards ──────────────────────────────────────── */

export function FeatureCard({ index, big, photo, icon, title, text, children }: { index: number; big: boolean; photo: string; icon: ReactNode; title: string; text: string; children?: ReactNode }) {
  function move(e: React.MouseEvent<HTMLElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  }
  return (
    <motion.article onMouseMove={move} initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 1, ease: EASE, delay: (index % 3) * 0.08 }}
      className={cn('feature-card group relative isolate flex min-h-[320px] flex-col overflow-hidden rounded-[28px] border p-7', big ? 'border-transparent bg-ionian-950 text-limestone-50 md:col-span-2' : 'border-limestone-200 bg-white')}>
      <div className="feature-photo absolute inset-0 -z-10">
        <Photo src={photo} alt="" sizes="(min-width:768px) 66vw, 100vw" className="absolute inset-0 scale-110 transition-transform duration-[1800ms] ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-100" />
        <div className="absolute inset-0 bg-gradient-to-t from-ionian-950 via-ionian-950/75 to-ionian-950/30" />
      </div>
      {big && <div className="bg-qilim pointer-events-none absolute inset-0 -z-20 opacity-20" />}
      <div className="flex items-start justify-between">
        <div className={cn('grid size-11 place-items-center rounded-full border transition-colors duration-700 group-hover:border-gold-400/60 group-hover:text-gold-400', big ? 'border-white/20 text-gold-400' : 'border-limestone-300 text-ionian-700')}>{icon}</div>
        <span className={cn('font-mono text-xs transition-colors duration-700 group-hover:text-limestone-200', big ? 'text-ionian-300' : 'text-limestone-500')}>{String(index + 1).padStart(2, '0')}</span>
      </div>
      <div className={cn('mt-auto', big && 'md:grid md:grid-cols-[1fr_1.1fr] md:items-end md:gap-8')}>
        <div className="pt-10">
          <h3 className="font-display text-3xl transition-colors duration-700 group-hover:text-limestone-50 md:text-4xl">{title}</h3>
          <p className={cn('mt-3 max-w-md text-sm leading-relaxed transition-colors duration-700 group-hover:text-ionian-100', big ? 'text-ionian-200' : 'text-limestone-700')}>{text}</p>
        </div>
        {children && <div className="mt-8 md:mt-0">{children}</div>}
      </div>
      <span className="absolute inset-x-7 bottom-0 h-px origin-left scale-x-0 bg-gold-400 transition-transform duration-1000 group-hover:scale-x-100" />
    </motion.article>
  );
}

export function AskDemo({ locale }: { locale: string }) {
  const en = locale === 'en';
  const [ref, go] = useStart(300);
  const [ans, setAns] = useState(false);
  const bars = [42, 55, 48, 61, 94, 78, 66];
  const days = en ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['H', 'M', 'M', 'E', 'P', 'S', 'D'];
  return (
    <div ref={ref} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-md">
      <p className="flex items-center gap-2 font-mono text-[11px] text-ionian-200"><Sparkles className="size-3.5 text-gold-400" />{en ? 'How much did the bar make this week?' : 'Sa fitoi bari këtë javë?'}</p>
      <p className="mt-3 min-h-[40px] text-sm text-limestone-50"><Stream text={en ? '€3,940, up 18% on last week. Friday sunset was the peak.' : '3.940 €, 18% më shumë se java e kaluar. Kulmi ishte perëndimi i së premtes.'} start={go} speed={55} onDone={() => setAns(true)} /></p>
      <div className="mt-3 flex h-20 items-end gap-1.5">
        {bars.map((h, i) => <motion.div key={i} initial={{ height: 0 }} animate={ans ? { height: `${h}%` } : {}} transition={{ delay: i * 0.06, duration: 0.9, ease: EASE }} className={cn('flex-1 rounded-t-sm', i === 4 ? 'bg-gold-400' : 'bg-ionian-400/50')} />)}
      </div>
      <div className="mt-1.5 flex gap-1.5 font-mono text-[9px] text-ionian-300">{days.map((d, i) => <span key={i} className="flex-1 text-center">{d}</span>)}</div>
    </div>
  );
}

export function InboxDemo({ locale }: { locale: string }) {
  const en = locale === 'en';
  const [ref, go] = useStart(300);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!go || n >= 3) return;
    const t = setTimeout(() => setN((x) => x + 1), 900);
    return () => clearTimeout(t);
  }, [go, n]);
  const threads = [
    { c: 'var(--color-ch-whatsapp)', k: 'WhatsApp', who: 'Marco R.', m: en ? 'Sea view for 14–17 Aug?' : 'Pamje nga deti 14–17 gusht?' },
    { c: '#C13584', k: 'Instagram', who: 'Elira K.', m: en ? 'Is the spa open Sunday?' : 'A është spa hapur të dielën?' },
    { c: '#0084FF', k: 'Messenger', who: 'Jonas W.', m: en ? 'Airport transfer at 22:40' : 'Transfertë nga aeroporti 22:40' },
  ];
  return (
    <div ref={ref} className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-md">
      {threads.map((t, i) => (
        <div key={t.who} className="flex items-center gap-3 px-4 py-3">
          <span className="size-2 shrink-0 rounded-full" style={{ background: t.c }} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-limestone-50">{t.who} <span className="font-normal text-ionian-300">· {t.k}</span></p>
            <p className="truncate text-xs text-ionian-200">{t.m}</p>
          </div>
          <AnimatePresence mode="wait">
            {i < n
              ? <motion.span key="ok" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-1 rounded-full bg-gold-400/15 px-2 py-0.5 text-[10px] text-gold-400"><CheckCheck className="size-3" />AI</motion.span>
              : <motion.span key="wait" exit={{ opacity: 0 }} className="typing-dots text-ionian-300"><span /><span /><span /></motion.span>}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}

/* ─── cinematic interlude ────────────────────────────────── */

export function Interlude({ locale }: { locale: string }) {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], ['-10%', '10%']);
  const inset = useTransform(scrollYProgress, [0, 0.45], [8, 0]);
  const clip = useTransform(inset, (v) => `inset(${v}% ${v}% ${v}% ${v}% round 28px)`);
  const lines = locale === 'en' ? ['At 23:00 the resort sleeps.', 'Iliria doesn’t.'] : ['Në 23:00 resorti fle.', 'Iliria jo.'];
  return (
    <section ref={ref} className="relative h-[110svh] overflow-hidden bg-ionian-950">
      <motion.div style={{ clipPath: clip }} className="absolute inset-0">
        <motion.div style={{ y }} className="absolute inset-x-0 -inset-y-[12%]"><Photo src={`${IMG}/night.jpg`} alt="" className="absolute inset-0" /></motion.div>
        <div className="absolute inset-0 bg-gradient-to-t from-ionian-950/80 via-ionian-950/20 to-transparent" />
      </motion.div>
      <div className="relative z-10 flex h-full items-end px-6 pb-24 md:px-16">
        <h2 className="font-display max-w-4xl text-5xl leading-[1.02] text-limestone-50 md:text-8xl">
          {lines.map((l, i) => <RevealLine key={l} onView delay={i * 0.15} className={cn(i === 1 && 'text-shimmer italic')}>{l}</RevealLine>)}
        </h2>
      </div>
    </section>
  );
}
