'use client';

import { useState } from 'react';
import { Check, Copy, Mic, PhoneCall, PhoneForwarded } from 'lucide-react';
import { PageHero } from '@/components/app/page-hero';
import { Badge } from '@/components/ui/badge';
import { relativeTime } from '@/lib/dates';
import { cn } from '@/lib/utils';
import type { VoiceData } from '@/server/queries/voice';

const COPY = {
  sq: {
    eyebrow: 'Asistenti zanor',
    title: 'Telefonata përgjigjet edhe kur recepsioni është i zënë.',
    subtitle: 'AI flet shqip dhe anglisht, kontrollon disponueshmërinë, merr rezervime dhe të kalon te recepsioni kur duhet. Çdo telefonatë regjistrohet me përmbledhje.',
    calls: 'Telefonatat',
    empty: 'Asnjë telefonatë ende. Lidhe numrin dhe testoje.',
    setup: 'Lidhja me Vapi',
    steps: ['Krijo një llogari te Vapi dhe blej ose lidh një numër telefoni.', 'Vendos VAPI_SERVER_SECRET në Vercel (çdo vlerë e gjatë e rastësishme).', 'Krijo një Assistant me JSON-in më poshtë. Shto në Server URL header-in x-vapi-secret me të njëjtën vlerë.', 'Telefono numrin dhe testo zërin shqip. Nëse tingëllon robotik, ndërro zërin Azure ose kalo te ElevenLabs.'],
    serverUrl: 'Server URL',
    config: 'JSON i Assistant-it (ngjite te Vapi)',
    copy: 'Kopjo',
    copied: 'U kopjua',
    secretMissing: 'VAPI_SERVER_SECRET mungon.',
    secretOk: 'VAPI_SERVER_SECRET është vendosur.',
    frontDesk: 'Numri i recepsionit për transferim',
    frontDeskHint: 'Ndryshoje te Cilësimet (frontDeskPhone).',
    outcome: { transferred: 'U transferua', completed: 'Përfundoi', booked: 'U rezervua', callback: 'Kërkoi kthim telefonate' } as Record<string, string>,
    summary: 'Përmbledhja',
    transcript: 'Transkripti',
    caller: 'Telefonuesi',
    ai: 'AI',
    seconds: 'sek',
    recording: 'Dëgjo regjistrimin',
  },
  en: {
    eyebrow: 'Voice assistant',
    title: 'The phone gets answered even when reception is busy.',
    subtitle: 'The AI speaks Albanian and English, checks availability, takes bookings and hands you to reception when needed. Every call is logged with a summary.',
    calls: 'Calls',
    empty: 'No calls yet. Connect the number and test it.',
    setup: 'Connect Vapi',
    steps: ['Create a Vapi account and buy or import a phone number.', 'Set VAPI_SERVER_SECRET in Vercel (any long random value).', 'Create an Assistant with the JSON below. Add the x-vapi-secret header with the same value to the Server URL.', 'Call the number and test the Albanian voice. If it sounds robotic, change the Azure voice or move to ElevenLabs.'],
    serverUrl: 'Server URL',
    config: 'Assistant JSON (paste into Vapi)',
    copy: 'Copy',
    copied: 'Copied',
    secretMissing: 'VAPI_SERVER_SECRET is missing.',
    secretOk: 'VAPI_SERVER_SECRET is set.',
    frontDesk: 'Front desk number for transfers',
    frontDeskHint: 'Change it in Settings (frontDeskPhone).',
    outcome: { transferred: 'Transferred', completed: 'Completed', booked: 'Booked', callback: 'Asked for a callback' },
    summary: 'Summary',
    transcript: 'Transcript',
    caller: 'Caller',
    ai: 'AI',
    seconds: 'sec',
    recording: 'Listen to the recording',
  },
};

export function VoiceView({ data, locale, mounted }: { data: VoiceData; locale: string; mounted: string }) {
  const c = COPY[locale === 'en' ? 'en' : 'sq'] as (typeof COPY)['sq'];
  const [sel, setSel] = useState<string | null>(data.calls[0]?.id ?? null);
  const [copied, setCopied] = useState<string | null>(null);
  const call = data.calls.find((x) => x.id === sel) ?? null;
  const copy = (key: string, text: string) => { void navigator.clipboard.writeText(text); setCopied(key); window.setTimeout(() => setCopied(null), 1500); };
  const json = data.config ? JSON.stringify(data.config, null, 2) : '';

  return (
    <div className="mx-auto max-w-6xl">
      <PageHero eyebrow={c.eyebrow} title={c.title} subtitle={c.subtitle} />
      <div className="mt-6 grid gap-4 lg:grid-cols-[22rem_1fr]">
        <aside className="space-y-1.5">
          <h2 className="px-1 text-xs tracking-wider text-muted uppercase">{c.calls}</h2>
          {data.calls.length === 0 && <p className="rounded-xl border border-dashed border-border-strong py-12 text-center text-sm text-muted">{c.empty}</p>}
          {data.calls.map((k) => (
            <button key={k.id} type="button" onClick={() => setSel(k.id)} className={cn('flex w-full items-center gap-3 rounded-xl border bg-surface p-3 text-left transition-all hover:-translate-y-px', sel === k.id ? 'border-ionian-500 shadow-soft' : 'border-border')}>
              <span className="grid size-10 shrink-0 place-items-center rounded-full text-white" style={{ background: 'var(--color-ch-phone)' }}>{k.transferredTo ? <PhoneForwarded className="size-4" /> : <PhoneCall className="size-4" />}</span>
              <span className="min-w-0 flex-1"><span className="flex justify-between gap-2"><span className="truncate text-sm font-medium">{k.from ?? '—'}</span><span className="shrink-0 text-[10px] text-subtle">{relativeTime(new Date(k.createdAt), locale, new Date(mounted))}</span></span><span className="block truncate text-xs text-muted">{k.summary}</span></span>
            </button>
          ))}
        </aside>
        <section>
          {call ? (
            <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
              <div className="flex flex-wrap items-center gap-2"><h2 className="font-display text-3xl">{call.from ?? '—'}</h2><Badge tone={call.transferredTo ? 'accent' : 'success'} dot>{c.outcome[call.outcome ?? 'completed'] ?? call.outcome}</Badge><span className="text-xs text-muted">{call.durationSec} {c.seconds}</span></div>
              <p className="mt-4 text-[11px] tracking-wider text-subtle uppercase">{c.summary}</p>
              <p className="mt-1 text-sm leading-relaxed">{call.summary}</p>
              {call.recordingUrl && <a href={call.recordingUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-xs text-ionian-600 underline"><Mic className="size-3.5" />{c.recording}</a>}
              <p className="mt-5 text-[11px] tracking-wider text-subtle uppercase">{c.transcript}</p>
              <div className="mt-2 space-y-2">
                {call.transcript.map((m, i) => (
                  <div key={i} className={cn('flex', m.role === 'caller' ? 'justify-start' : 'justify-end')}>
                    <div className={cn('max-w-[80%] rounded-2xl px-3.5 py-2 text-sm', m.role === 'caller' ? 'rounded-bl-md bg-surface-2' : 'ai-glow rounded-br-md')}><p className="mb-0.5 text-[10px] tracking-wider text-subtle uppercase">{m.role === 'caller' ? c.caller : c.ai}</p>{m.text}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-qilim grid h-64 place-items-center rounded-2xl border border-dashed border-border-strong text-muted">{c.empty}</div>
          )}
        </section>
      </div>

      <section className="mt-10 mb-10 rounded-2xl border border-border bg-surface p-6 shadow-soft">
        <h2 className="font-display text-3xl">{c.setup}</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-muted">{c.steps.map((s) => <li key={s}>{s}</li>)}</ol>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div><p className="text-xs text-muted">{c.serverUrl}</p><div className="mt-1 flex items-center gap-2"><code className="min-w-0 flex-1 truncate rounded-md bg-surface-2 px-3 py-2 text-xs">{data.serverUrl}</code><button type="button" onClick={() => copy('url', data.serverUrl)} className="grid size-8 place-items-center rounded-md border border-border-strong hover:bg-surface-2">{copied === 'url' ? <Check className="size-4" /> : <Copy className="size-4" />}</button></div></div>
          <div><p className="text-xs text-muted">{c.frontDesk}</p><p className="mt-1 text-sm">{data.frontDeskPhone ?? '—'} <span className="text-xs text-subtle">· {c.frontDeskHint}</span></p><p className={cn('mt-2 text-xs', data.secretSet ? 'text-success' : 'text-danger')}>{data.secretSet ? c.secretOk : c.secretMissing}</p></div>
        </div>
        {json && (
          <div className="mt-5">
            <div className="flex items-center justify-between"><p className="text-xs text-muted">{c.config}</p><button type="button" onClick={() => copy('json', json)} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border-strong px-3 text-xs hover:bg-surface-2">{copied === 'json' ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}{copied === 'json' ? c.copied : c.copy}</button></div>
            <pre className="mt-2 max-h-72 overflow-auto rounded-xl bg-ionian-950 p-4 text-[11px] leading-relaxed text-ionian-100">{json}</pre>
          </div>
        )}
      </section>
    </div>
  );
}
