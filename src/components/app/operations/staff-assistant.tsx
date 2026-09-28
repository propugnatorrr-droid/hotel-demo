'use client';

import { useState } from 'react';
import { ArrowUp, Check, Sparkles } from 'lucide-react';
import { createHousekeepingTask } from '@/server/actions/operations';

type Proposal = { roomId: string; roomNumber: string; type: string; notes: string };
type Entry = {
  question: string;
  answer: string;
  proposals: Proposal[];
};

export function StaffAssistant({ locale, today }: { locale: string; today: string }) {
  const [text, setText] = useState('');
  const [entries, setEntries] = useState<Entry[]>([]);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const [error, setError] = useState('');

  const en = locale === 'en';

  async function ask(event: React.FormEvent) {
    event.preventDefault();
    const message = text.trim();
    if (!message || busy) return;

    setBusy(true);
    setError('');
    setText('');

    try {
      const response = await fetch('/api/ai/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, locale: en ? 'en' : 'sq' }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'AI request failed');

      setEntries((prev) => [...prev, { question: message, answer: body.reply, proposals: body.proposals || [] }]);
    } catch (err) {
      setText(message);
      setError(err instanceof Error ? err.message : 'AI request failed');
    } finally {
      setBusy(false);
    }
  }

  async function confirm(p: Proposal) {
    const key = `${p.roomId}-${p.type}-${p.notes}`;
    setConfirming(key);
    setError('');
    try {
      const form = new FormData();
      form.set('roomId', p.roomId);
      form.set('type', p.type);
      form.set('notes', p.notes);
      form.set('dueDate', today);
      form.set('priority', 'normal');
      await createHousekeepingTask(form);
      setConfirmed((prev) => [...prev, key]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setConfirming(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <header className="relative overflow-hidden rounded-2xl bg-ionian-950 p-8 text-limestone-50 md:p-12">
        <div className="pointer-events-none absolute -right-16 -top-28 size-96 rounded-full border-[45px] border-gold-400/10" />
        <p className="flex items-center gap-2 text-xs tracking-[0.25em] text-gold-400 uppercase">
          <Sparkles className="size-4" /> {en ? 'Operations intelligence' : 'Inteligjencë për operacionet'}
        </p>
        <h1 className="font-display relative mt-6 text-5xl md:text-7xl">
          {en ? 'Ask your hotel.' : 'Pyet hotelin tënd.'}
        </h1>
        <p className="relative mt-4 max-w-xl text-sm leading-relaxed text-ionian-200">
          {en
            ? 'Real room status and work queues. Actions require your confirmation.'
            : 'Gjendja reale e dhomave dhe detyrat e ekipit. Çdo veprim kërkon konfirmimin tënd.'}
        </p>
      </header>

      <div className="space-y-6 py-8">
        {entries.length === 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {(en
              ? ['Which rooms need cleaning?', 'What work is pending?', 'Is room 204 occupied?', 'Create an inspection task for room 201']
              : ['Cilat dhoma duan pastrim?', 'Cilat punë janë në pritje?', 'A është dhoma 204 e zënë?', 'Krijo një detyrë kontrolli për dhomën 201']
            ).map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => setText(suggestion)}
                className="rounded-xl border border-border bg-surface p-5 text-left font-serif text-xl transition-all hover:-translate-y-0.5 hover:shadow-lift"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}

        {entries.map((entry, index) => (
          <div key={index} className="space-y-4">
            <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-5 py-3 text-sm text-primary-foreground">
              {entry.question}
            </p>
            <div className="max-w-[90%] rounded-2xl rounded-bl-sm border border-border bg-surface p-6 shadow-soft">
              <span className="mb-3 inline-flex items-center gap-2 text-xs text-accent"><Sparkles className="size-3.5" /> Iliria</span>
              <p className="text-sm leading-7 whitespace-pre-wrap">{entry.answer}</p>
            </div>

            {entry.proposals.map((p, i) => {
              const key = `${p.roomId}-${p.type}-${p.notes}`;
              const done = confirmed.includes(key);
              return (
                <div key={i} className="max-w-[90%] rounded-xl border border-gold-400 bg-accent-soft p-5">
                  <p className="text-xs font-semibold tracking-wide text-accent uppercase">
                    {en ? 'Proposed action · not saved yet' : 'Veprim i propozuar · ende i paruajtur'}
                  </p>
                  <p className="mt-2 font-serif text-2xl">
                    {en ? 'Room' : 'Dhoma'} {p.roomNumber} · {p.type.replaceAll('_', ' ')}
                  </p>
                  {p.notes && <p className="mt-2 text-sm">{p.notes}</p>}
                  <button
                    type="button"
                    disabled={done || confirming === key}
                    onClick={() => confirm(p)}
                    className="mt-4 inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-xs text-primary-foreground disabled:opacity-50"
                  >
                    <Check className="size-3.5" />
                    {done ? (en ? 'Saved' : 'U ruajt') : (en ? 'Confirm and create task' : 'Konfirmo dhe krijo detyrën')}
                  </button>
                </div>
              );
            })}
          </div>
        ))}

        {busy && <p className="text-sm text-muted">{en ? 'Checking live data…' : 'Po kontrolloj të dhënat…'}</p>}
        {error && <p role="alert" className="rounded-md bg-danger-soft p-4 text-sm text-danger">{error}</p>}
      </div>

      <form onSubmit={ask} className="sticky bottom-4 flex gap-2 rounded-xl border border-border bg-surface/95 p-2 shadow-float backdrop-blur">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={1000}
          placeholder={en ? 'Ask about a room or task…' : 'Pyet për një dhomë ose detyrë…'}
          className="min-w-0 flex-1 bg-transparent px-4 text-sm outline-none"
          aria-label={en ? 'Message' : 'Mesazhi'}
        />
        <button
          type="submit"
          disabled={!text.trim() || busy}
          className="flex size-11 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-50"
          aria-label={en ? 'Send' : 'Dërgo'}
        >
          <ArrowUp className="size-4" />
        </button>
      </form>
      <p className="pb-6 pt-3 text-center text-xs text-subtle">
        {en ? 'AI can be wrong. Verify details before confirming changes.' : 'AI mund të gabojë. Kontrollo detajet përpara konfirmimit.'}
      </p>
    </div>
  );
}
