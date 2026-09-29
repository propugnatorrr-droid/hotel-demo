'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { formatCurrency, type Currency } from '@/lib/format';
import type { OwnerAnswer } from '@/server/services/owner-ai';

type State = { status: 'loading' } | { status: 'ok'; data: OwnerAnswer } | { status: 'error'; message: string };

const ERR = {
  sq: { ai_off: 'AI nuk është konfiguruar ende (OPENROUTER_API_KEY).', limit: 'Kufiri orar u arrit. Provo pas pak.', forbidden: 'Ky pyetje kërkon rol pronari ose menaxheri.', failed: 'Nuk arrita t’i përgjigjem. Provo përsëri.', module: 'Moduli AI është i çaktivizuar.', thinking: 'Po shikoj të dhënat e hotelit…' },
  en: { ai_off: 'AI is not configured yet (OPENROUTER_API_KEY).', limit: 'Hourly limit reached. Try again shortly.', forbidden: 'This question needs an owner or manager role.', failed: 'I could not answer. Try again.', module: 'The AI module is disabled.', thinking: 'Looking at your hotel data…' },
};

/** Answers one question inline: text, optional mini bar chart, and jump links. */
export function AskPanel({ question, mode, locale, currency }: { question: string; mode: 'owner' | 'staff'; locale: string; currency: Currency }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const e = ERR[locale === 'en' ? 'en' : 'sq'];

  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    fetch(mode === 'owner' ? '/api/ai/owner' : '/api/ai/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: question, locale: locale === 'en' ? 'en' : 'sq' }),
    })
      .then(async (r) => {
        const j = await r.json();
        if (!alive) return;
        if (!r.ok) return setState({ status: 'error', message: e[(j.error as keyof typeof e) ?? 'failed'] ?? e.failed });
        setState({ status: 'ok', data: mode === 'owner' ? (j as OwnerAnswer) : { answer: j.reply, chart: null, links: [] } });
      })
      .catch(() => alive && setState({ status: 'error', message: e.failed }));
    return () => {
      alive = false;
    };
  }, [question, mode, locale, e]);

  return (
    <div className="ai-glow animate-fade-up rounded-xl p-5">
      <p className="flex items-center gap-1.5 text-xs font-medium tracking-wide text-accent uppercase"><Sparkles className="size-3.5" /> {locale === 'en' ? 'Ask your hotel' : 'Pyet hotelin'}</p>
      <p className="font-display mt-2 text-2xl leading-tight">“{question}”</p>
      {state.status === 'loading' && (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-muted">{e.thinking}</p>
          {[80, 60, 40].map((w) => <div key={w} className="h-3 animate-pulse rounded bg-surface-3/70" style={{ width: `${w}%` }} />)}
        </div>
      )}
      {state.status === 'error' && <p className="mt-4 text-sm text-danger">{state.message}</p>}
      {state.status === 'ok' && (
        <div className="mt-4 space-y-4">
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{state.data.answer}</p>
          {state.data.chart && <MiniChart chart={state.data.chart} locale={locale} currency={currency} />}
          {state.data.links.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {state.data.links.map((l) => (
                <Link key={l.path} href={l.path} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border-strong bg-surface px-3 text-xs hover:bg-surface-2">{l.label} <ArrowUpRight className="size-3" /></Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MiniChart({ chart, locale, currency }: { chart: NonNullable<OwnerAnswer['chart']>; locale: string; currency: Currency }) {
  const max = Math.max(1, ...chart.points.map((p) => p.value));
  const fmt = (v: number) => (chart.unit === 'money' ? formatCurrency(v, currency, locale, 0) : chart.unit === 'percent' ? `${Math.round(v)}%` : String(Math.round(v * 100) / 100));
  return (
    <div className="rounded-lg bg-surface/70 p-3">
      <p className="mb-2 text-xs text-muted">{chart.title}</p>
      <div className="flex h-28 items-end gap-1.5">
        {chart.points.map((p, i) => (
          <div key={`${p.label}-${i}`} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${p.label}: ${fmt(p.value)}`}>
            <span className="text-[9px] text-muted opacity-0 transition-opacity group-hover:opacity-100">{fmt(p.value)}</span>
            <div className="w-full rounded-t bg-gradient-to-t from-ionian-700 to-ionian-400 transition-all duration-700" style={{ height: `${Math.max(3, (p.value / max) * 100)}%`, transitionDelay: `${i * 40}ms` }} />
            <span className="w-full truncate text-center text-[9px] text-subtle">{p.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
