'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUp, Check, CircleAlert, Loader2, Mic, Play, ShieldCheck, Sparkles, X, Zap } from 'lucide-react';
import { PageHero } from '@/components/app/page-hero';
import { cn } from '@/lib/utils';

type Step = { id: string; label: string; state: 'running' | 'ok' | 'error'; write?: boolean; note?: string };
type Proposal = { id: string; tool: string; args: Record<string, unknown>; label: string; risk: 'safe' | 'confirm'; summary: string; state: 'pending' | 'running' | 'done' | 'failed' | 'rejected'; error?: string };
type Turn = { id: number; role: 'user' | 'agent'; text?: string; steps: Step[]; proposals: Proposal[]; answer?: string; thinking: boolean; error?: string };

const COPY = {
  sq: {
    eyebrow: 'Agjenti i hotelit',
    title: 'Thuaj çfarë duhet bërë. Ai e bën.',
    subtitle: 'Rezervime, çmime, pastrim, fatura, mesazhe: agjenti lexon të dhënat reale dhe kryen veprimet me lejet e tua. Çdo gjë e rrezikshme kërkon konfirmimin tënd.',
    placeholder: 'P.sh. Rezervo dhomën 204 për Marco Rossi nga 14 deri 17 gusht…',
    auto: 'Mënyra automatike',
    autoHint: 'Veprimet e sigurta kryhen vetë. Anulimet, rimbursimet, çmimet dhe mesazhet pyesin gjithmonë.',
    review: 'Mënyra e rishikimit: gjithçka pyet para se të kryhet.',
    thinking: ['Po mendoj…', 'Po lidh të dhënat…', 'Po kontrolloj hotelin…', 'Po planifikoj hapat…'],
    confirm: 'Konfirmo',
    reject: 'Refuzo',
    confirmAll: 'Konfirmo të gjitha',
    needsApproval: 'Kërkon aprovim',
    done: 'U krye',
    failed: 'Dështoi',
    rejected: 'Refuzuar',
    running: 'Po kryhet…',
    suggestions: ['Kush mbërrin sot dhe cilat dhoma janë gati?', 'Rezervo një Deluxe për 2 persona nga 20 deri 23 gusht për Elira Krasniqi, tel. +355691234567', 'Ngri çmimet 10% për fundjavat e gushtit te Deluxe', 'Shëno dhomën 108 të pastër dhe krijo detyrë inspektimi', 'Sa fituam këtë javë dhe cili kanal na sjell më shumë?', 'A ka alarme që kërkojnë vëmendje?'],
    clear: 'Pastro bisedën',
    mic: 'Fol',
    errors: { ai_off: 'AI nuk është konfiguruar (OPENROUTER_API_KEY).', limit: 'Kufiri orar u arrit. Provo pas pak.', forbidden: 'Roli yt nuk ka veprime të disponueshme.', failed: 'Diçka shkoi keq.' } as Record<string, string>,
    listening: 'Po dëgjoj…',
  },
  en: {
    eyebrow: 'Hotel agent',
    title: 'Say what needs doing. It does it.',
    subtitle: 'Bookings, rates, housekeeping, invoices, messages: the agent reads your real data and performs actions with your permissions. Anything risky needs your confirmation.',
    placeholder: 'E.g. Book room 204 for Marco Rossi from 14 to 17 August…',
    auto: 'Auto mode',
    autoHint: 'Safe actions run by themselves. Cancellations, refunds, rates and messages always ask.',
    review: 'Review mode: everything asks before it runs.',
    thinking: ['Thinking…', 'Connecting the data…', 'Checking the hotel…', 'Planning the steps…'],
    confirm: 'Confirm',
    reject: 'Reject',
    confirmAll: 'Confirm all',
    needsApproval: 'Needs approval',
    done: 'Done',
    failed: 'Failed',
    rejected: 'Rejected',
    running: 'Running…',
    suggestions: ['Who arrives today and which rooms are ready?', 'Book a Deluxe for 2 from 20 to 23 August for Elira Krasniqi, phone +355691234567', 'Raise Deluxe prices 10% on August weekends', 'Mark room 108 clean and create an inspection task', 'How much did we earn this week and which channel brings the most?', 'Any alerts that need attention?'],
    clear: 'Clear chat',
    mic: 'Speak',
    errors: { ai_off: 'AI is not configured (OPENROUTER_API_KEY).', limit: 'Hourly limit reached. Try again shortly.', forbidden: 'Your role has no actions available.', failed: 'Something went wrong.' },
    listening: 'Listening…',
  },
};

const STORE = 'iliria.agent.auto';

function Orb({ phrases }: { phrases: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setI((x) => (x + 1) % phrases.length), 1800);
    return () => window.clearInterval(t);
  }, [phrases.length]);
  return (
    <div className="flex items-center gap-4">
      <div className="relative size-10">
        <motion.span className="absolute inset-0 rounded-full bg-gradient-to-tr from-gold-400 via-terracotta-400 to-ionian-400 blur-md" animate={{ scale: [1, 1.35, 1], opacity: [0.55, 0.9, 0.55] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }} />
        <motion.span className="absolute inset-1 rounded-full bg-[conic-gradient(from_0deg,var(--color-gold-400),var(--color-ionian-400),var(--color-terracotta-400),var(--color-gold-400))]" animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }} />
        <span className="absolute inset-[9px] rounded-full bg-surface" />
        <Sparkles className="absolute inset-0 m-auto size-3.5 text-accent" />
      </div>
      <AnimatePresence mode="wait">
        <motion.span key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }} className="text-sm text-muted">{phrases[i]}</motion.span>
      </AnimatePresence>
    </div>
  );
}

function Typewriter({ text, onTick }: { text: string; onTick?: () => void }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const step = Math.max(1, Math.ceil(text.length / 160));
    const t = window.setInterval(() => {
      setN((x) => {
        if (x >= text.length) {
          window.clearInterval(t);
          return x;
        }
        return Math.min(text.length, x + step);
      });
      onTick?.();
    }, 16);
    return () => window.clearInterval(t);
  }, [text, onTick]);
  return <>{text.slice(0, n)}{n < text.length && <span className="ml-0.5 inline-block h-[1em] w-0.5 animate-pulse bg-current align-middle" />}</>;
}

function StepRow({ s }: { s: Step }) {
  return (
    <motion.li layout initial={{ opacity: 0, x: -14, height: 0 }} animate={{ opacity: 1, x: 0, height: 'auto' }} transition={{ type: 'spring', stiffness: 380, damping: 32 }} className={cn('flex items-center gap-2.5 overflow-hidden text-[13px]', s.write ? 'font-medium text-foreground' : 'text-muted')}>
      <span className="relative grid size-5 shrink-0 place-items-center">
        {s.state === 'running' && <Loader2 className="size-4 animate-spin text-accent" />}
        {s.state === 'ok' && <motion.span initial={{ scale: 0 }} animate={{ scale: [0, 1.4, 1] }} transition={{ duration: 0.4 }} className={cn('grid size-5 place-items-center rounded-full text-white', s.write ? 'bg-success' : 'bg-ionian-500')}><Check className="size-3" /></motion.span>}
        {s.state === 'error' && <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="grid size-5 place-items-center rounded-full bg-danger text-white"><X className="size-3" /></motion.span>}
      </span>
      <span className={cn(s.state === 'running' && 'text-shimmer')}>{s.label}</span>
      {s.note && <span className="truncate text-xs text-danger">{s.note}</span>}
    </motion.li>
  );
}

function ProposalCard({ p, t, onConfirm, onReject }: { p: Proposal; t: (typeof COPY)['sq']; onConfirm: () => void; onReject: () => void }) {
  return (
    <motion.div layout initial={{ opacity: 0, y: 14, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 320, damping: 26 }} className={cn('relative overflow-hidden rounded-2xl p-4', p.state === 'pending' || p.state === 'running' ? 'ai-glow' : 'border border-border bg-surface')}>
      {p.state === 'running' && <motion.span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-gold-400 to-transparent" initial={{ x: '-100%' }} animate={{ x: '100%' }} transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }} />}
      <div className="flex items-start gap-3">
        <span className={cn('mt-0.5 grid size-8 shrink-0 place-items-center rounded-full', p.state === 'done' ? 'bg-success-soft text-success' : p.state === 'failed' ? 'bg-danger-soft text-danger' : p.risk === 'confirm' ? 'bg-accent-soft text-accent' : 'bg-ionian-100 text-ionian-700')}>
          {p.state === 'done' ? <motion.span initial={{ scale: 0 }} animate={{ scale: [0, 1.5, 1] }}><Check className="size-4" /></motion.span> : p.state === 'failed' ? <CircleAlert className="size-4" /> : p.state === 'running' ? <Loader2 className="size-4 animate-spin" /> : <Zap className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] tracking-wider text-subtle uppercase">{p.label}{p.risk === 'confirm' && p.state === 'pending' ? ` · ${t.needsApproval}` : ''}</p>
          <p className={cn('mt-0.5 text-sm leading-snug', p.state === 'rejected' && 'text-muted line-through')}>{p.summary}</p>
          {p.state === 'failed' && <p className="mt-1 text-xs text-danger">{p.error}</p>}
          {p.state === 'done' && <p className="mt-1 text-xs text-success">{t.done}</p>}
          {p.state === 'rejected' && <p className="mt-1 text-xs text-muted">{t.rejected}</p>}
        </div>
        {p.state === 'pending' && (
          <div className="flex shrink-0 gap-1.5">
            <button type="button" onClick={onReject} className="h-8 rounded-full border border-border-strong px-3 text-xs text-muted hover:bg-surface-2">{t.reject}</button>
            <button type="button" onClick={onConfirm} className="inline-flex h-8 items-center gap-1 rounded-full bg-ionian-900 px-3.5 text-xs font-medium text-limestone-50 hover:-translate-y-px"><Play className="size-3" />{t.confirm}</button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function AgentChat({ locale, initialQuestion }: { locale: string; initialQuestion?: string }) {
  const t = COPY[locale === 'en' ? 'en' : 'sq'] as (typeof COPY)['sq'];
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState(false);
  const [listening, setListening] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const started = useRef(false);

  useEffect(() => {
    try {
      setAuto(localStorage.getItem(STORE) === '1');
    } catch {
      /* ignore */
    }
  }, []);
  const scroll = useCallback(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, []);
  useEffect(() => {
    scroll();
  }, [turns, scroll]);

  const patchAgent = (id: number, fn: (t: Turn) => Turn) => setTurns((all) => all.map((x) => (x.id === id ? fn(x) : x)));

  const ask = useCallback(
    async (raw: string) => {
      const message = raw.trim();
      if (!message || busy) return;
      setBusy(true);
      setText('');
      const userId = nextId.current++;
      const agentId = nextId.current++;
      const history = turns
        .filter((x) => x.text || x.answer)
        .slice(-10)
        .map((x) => ({ role: x.role === 'user' ? ('user' as const) : ('assistant' as const), content: (x.role === 'user' ? x.text : x.answer) ?? '' }))
        .filter((h) => h.content);
      setTurns((all) => [...all, { id: userId, role: 'user', text: message, steps: [], proposals: [], thinking: false }, { id: agentId, role: 'agent', steps: [], proposals: [], thinking: true }]);

      let refreshNeeded = false;
      try {
        const res = await fetch('/api/ai/agent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, history, autoRun: auto, locale }) });
        if (!res.ok || !res.body) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          patchAgent(agentId, (x) => ({ ...x, thinking: false, error: t.errors[j.error ?? 'failed'] ?? t.errors.failed }));
          return;
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const parts = buf.split('\n\n');
          buf = parts.pop() ?? '';
          for (const part of parts) {
            const line = part.split('\n').find((l) => l.startsWith('data: '));
            if (!line) continue;
            const e = JSON.parse(line.slice(6)) as Record<string, unknown> & { type: string };
            if (e.type === 'thinking') patchAgent(agentId, (x) => ({ ...x, thinking: true }));
            if (e.type === 'tool') patchAgent(agentId, (x) => ({ ...x, steps: [...x.steps, { id: String(e.id), label: String(e.label), state: 'running', write: e.kind === 'write' }] }));
            if (e.type === 'tool_done') {
              if (e.write && e.ok) refreshNeeded = true;
              patchAgent(agentId, (x) => ({ ...x, steps: x.steps.map((s) => (s.id === e.id ? { ...s, state: e.ok ? 'ok' : 'error', label: e.write && e.summary ? String(e.summary) : s.label, note: e.ok ? undefined : String(e.error ?? '') } : s)) }));
            }
            if (e.type === 'proposal') patchAgent(agentId, (x) => ({ ...x, proposals: [...x.proposals, { id: String(e.id), tool: String(e.tool), args: e.args as Record<string, unknown>, label: String(e.label), risk: e.risk === 'safe' ? 'safe' : 'confirm', summary: String(e.summary), state: 'pending' }] }));
            if (e.type === 'answer') patchAgent(agentId, (x) => ({ ...x, thinking: false, answer: String(e.text) }));
            if (e.type === 'error') patchAgent(agentId, (x) => ({ ...x, thinking: false, error: String(e.message) }));
            if (e.type === 'done') patchAgent(agentId, (x) => ({ ...x, thinking: false }));
          }
        }
      } catch {
        patchAgent(agentId, (x) => ({ ...x, thinking: false, error: t.errors.failed }));
      } finally {
        setBusy(false);
        if (refreshNeeded) router.refresh();
      }
    },
    [auto, busy, locale, router, t.errors, turns],
  );

  useEffect(() => {
    if (initialQuestion && !started.current) {
      started.current = true;
      void ask(initialQuestion);
    }
  }, [initialQuestion, ask]);

  async function run(turnId: number, pid: string) {
    const turn = turns.find((x) => x.id === turnId);
    const p = turn?.proposals.find((x) => x.id === pid);
    if (!p || p.state !== 'pending') return;
    const set = (patch: Partial<Proposal>) => patchAgent(turnId, (x) => ({ ...x, proposals: x.proposals.map((y) => (y.id === pid ? { ...y, ...patch } : y)) }));
    set({ state: 'running' });
    const res = await fetch('/api/ai/agent/execute', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tool: p.tool, args: p.args, locale }) }).catch(() => null);
    const j = (await res?.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (j?.ok) {
      set({ state: 'done' });
      router.refresh();
    } else set({ state: 'failed', error: j?.error ?? t.errors.failed });
  }

  async function confirmAll(turnId: number) {
    const turn = turns.find((x) => x.id === turnId);
    for (const p of turn?.proposals.filter((x) => x.state === 'pending') ?? []) await run(turnId, p.id);
  }

  function listen() {
    const SR = (window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec }).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => SpeechRec }).webkitSpeechRecognition;
    if (!SR) return;
    const r = new SR();
    r.lang = locale === 'en' ? 'en-GB' : 'sq-AL';
    r.interimResults = true;
    r.onresult = (ev) => setText(Array.from(ev.results).map((x) => x[0]!.transcript).join(' '));
    r.onend = () => setListening(false);
    setListening(true);
    r.start();
  }

  return (
    <div className="mx-auto max-w-3xl">
      {turns.length === 0 ? (
        <PageHero eyebrow={t.eyebrow} title={t.title} subtitle={t.subtitle} />
      ) : (
        <motion.header initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 border-b border-border pb-5">
          <span className="ai-glow grid size-10 place-items-center rounded-full"><Sparkles className="size-4 text-accent" /></span>
          <div><p className="text-[11px] tracking-[0.25em] text-accent uppercase">{t.eyebrow}</p><p className="font-display text-2xl">{t.title}</p></div>
        </motion.header>
      )}

      <div className="mt-8 space-y-10 pb-44">
        {turns.length === 0 && (
          <div className="flex flex-wrap gap-3">
            {t.suggestions.map((s, i) => (
              <motion.button key={s} type="button" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.07 }} whileHover={{ y: -3 }} onClick={() => void ask(s)} className="rounded-2xl border border-border bg-surface px-4 py-3 text-left text-sm text-muted shadow-soft hover:border-border-strong hover:text-foreground">{s}</motion.button>
            ))}
          </div>
        )}

        {turns.map((turn) =>
          turn.role === 'user' ? (
            <motion.div key={turn.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end"><p className="max-w-[85%] rounded-3xl rounded-br-lg bg-ionian-900 px-5 py-3 text-[15px] text-limestone-50">{turn.text}</p></motion.div>
          ) : (
            <motion.div key={turn.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              {turn.steps.length > 0 && <ul className="space-y-2 border-l-2 border-border pl-4"><AnimatePresence initial={false}>{turn.steps.map((s) => <StepRow key={s.id} s={s} />)}</AnimatePresence></ul>}
              {turn.proposals.length > 0 && (
                <div className="space-y-2.5">
                  {turn.proposals.map((p) => <ProposalCard key={p.id} p={p} t={t} onConfirm={() => void run(turn.id, p.id)} onReject={() => patchAgent(turn.id, (x) => ({ ...x, proposals: x.proposals.map((y) => (y.id === p.id ? { ...y, state: 'rejected' } : y)) }))} />)}
                  {turn.proposals.filter((p) => p.state === 'pending').length > 1 && <button type="button" onClick={() => void confirmAll(turn.id)} className="ai-glow inline-flex h-10 items-center gap-2 rounded-full px-5 text-sm font-medium"><ShieldCheck className="size-4 text-accent" />{t.confirmAll}</button>}
                </div>
              )}
              {turn.thinking && !turn.answer && <Orb phrases={t.thinking} />}
              {turn.answer && <p className="text-[15.5px] leading-relaxed whitespace-pre-wrap"><Typewriter text={turn.answer} onTick={scroll} /></p>}
              {turn.error && <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{turn.error}</p>}
            </motion.div>
          ),
        )}
        <div ref={end} />
      </div>

      <div className="sticky bottom-0 z-20 -mx-5 mt-4 bg-gradient-to-t from-background from-70% to-transparent px-5 pt-10 pb-5 md:-mx-14 md:px-14">
        <form onSubmit={(e) => { e.preventDefault(); void ask(text); }} className="ai-glow flex items-end gap-2 rounded-3xl p-2 pl-5 shadow-float">
          <textarea value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void ask(text); } }} rows={1} maxLength={1500} placeholder={listening ? t.listening : t.placeholder} className="max-h-40 min-h-12 flex-1 resize-none bg-transparent py-3 text-base outline-none" />
          <button type="button" onClick={listen} title={t.mic} className={cn('grid size-11 shrink-0 place-items-center rounded-full border border-border-strong hover:bg-surface-2', listening && 'animate-pulse border-danger text-danger')}><Mic className="size-4" /></button>
          <button type="submit" disabled={busy || !text.trim()} className="grid size-11 shrink-0 place-items-center rounded-full bg-ionian-900 text-limestone-50 transition-transform hover:-translate-y-0.5 disabled:opacity-40">{busy ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}</button>
        </form>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-2 text-xs text-muted">
          <label className="inline-flex cursor-pointer items-center gap-2.5" title={t.autoHint}>
            <button type="button" role="switch" aria-checked={auto} onClick={() => { const v = !auto; setAuto(v); try { localStorage.setItem(STORE, v ? '1' : '0'); } catch { /* ignore */ } }} className={cn('relative h-6 w-11 rounded-full transition-colors', auto ? 'bg-success' : 'bg-surface-3')}>
              <motion.span layout transition={{ type: 'spring', stiffness: 500, damping: 30 }} className={cn('absolute top-0.5 size-5 rounded-full bg-white shadow', auto ? 'left-[22px]' : 'left-0.5')} />
            </button>
            <span className="font-medium text-foreground">{t.auto}</span>
          </label>
          <span className="hidden flex-1 sm:block">{auto ? t.autoHint : t.review}</span>
          {turns.length > 0 && <button type="button" onClick={() => setTurns([])} className="hover:text-foreground">{t.clear}</button>}
        </div>
      </div>
    </div>
  );
}

type SpeechRec = { lang: string; interimResults: boolean; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; start: () => void };
