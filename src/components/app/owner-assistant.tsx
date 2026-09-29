'use client';

import { useState } from 'react';
import { ArrowUp, Sparkles } from 'lucide-react';
import { AskPanel } from '@/components/app/ask-panel';
import { PageHero } from '@/components/app/page-hero';
import type { Currency } from '@/lib/format';

const COPY = {
  sq: {
    eyebrow: 'Pyet hotelin',
    title: 'Pyet çfarë të duash. Përgjigjet në sekonda.',
    subtitle: 'Shkruaj në shqip si t’i bësh pyetje një drejtori. AI shikon të dhënat reale të hotelit dhe të përgjigjet me numra, grafikë dhe lidhje.',
    placeholder: 'P.sh. Sa fitoi bari këtë javë?',
    suggestions: ['Sa fituam këtë javë krahasuar me javën e kaluar?', 'Kush mbërrin nesër?', 'Cili kanal na sjell më shumë para këtë muaj?', 'Sa ishte pushtimi javën e kaluar dhe sa pritet javën tjetër?', 'A ka diçka të pazakontë që duhet ta di?', 'Cilët janë mysafirët tanë më të mirë?'],
  },
  en: {
    eyebrow: 'Ask your hotel',
    title: 'Ask anything. Answers in seconds.',
    subtitle: 'Write like you would ask a general manager. The AI reads your real hotel data and answers with numbers, charts and links.',
    placeholder: 'E.g. How much did the bar make this week?',
    suggestions: ['How much did we earn this week compared to last week?', 'Who is arriving tomorrow?', 'Which channel brings the most money this month?', 'What was occupancy last week and what is expected next week?', 'Is there anything unusual I should know?', 'Who are our best guests?'],
  },
};

export function OwnerAssistant({ locale, currency }: { locale: string; currency: Currency }) {
  const c = COPY[locale === 'en' ? 'en' : 'sq'];
  const [text, setText] = useState('');
  const [asked, setAsked] = useState<{ id: number; q: string }[]>([]);

  const ask = (q: string) => {
    const v = q.trim();
    if (v.length < 2) return;
    setAsked((a) => [{ id: Date.now(), q: v }, ...a]);
    setText('');
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHero eyebrow={c.eyebrow} title={c.title} subtitle={c.subtitle} />
      <form onSubmit={(e) => { e.preventDefault(); ask(text); }} className="ai-glow mt-6 flex items-center gap-2 rounded-full p-1.5 pl-5">
        <Sparkles className="size-4 shrink-0 text-accent" />
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={c.placeholder} maxLength={600} className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none" />
        <button type="submit" disabled={text.trim().length < 2} className="grid size-11 place-items-center rounded-full bg-ionian-900 text-limestone-50 transition-transform hover:-translate-y-0.5 disabled:opacity-40"><ArrowUp className="size-4" /></button>
      </form>
      {asked.length === 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {c.suggestions.map((s) => <button key={s} type="button" onClick={() => ask(s)} className="rounded-full border border-border bg-surface px-3.5 py-2 text-sm text-muted transition-all hover:-translate-y-px hover:border-border-strong hover:text-foreground">{s}</button>)}
        </div>
      )}
      <div className="mt-6 space-y-4">
        {asked.map((a) => <AskPanel key={a.id} question={a.q} mode="owner" locale={locale} currency={currency} />)}
      </div>
    </div>
  );
}
