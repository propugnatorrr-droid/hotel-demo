'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Check, Copy, Network, RefreshCw, Send } from 'lucide-react';
import { PageHero } from '@/components/app/page-hero';
import { useAction } from '@/components/app/use-action';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SOURCE_COLOR } from '@/config/channels';
import { relativeTime } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { pushAvailability, saveMapping, setIntegration, syncAllMappings, syncMapping } from '@/server/actions/channels';
import type { ChannelsData } from '@/server/queries/channels';
import { pickChannelsCopy } from './copy';

const CHANNELS = ['booking_com', 'airbnb', 'expedia', 'agoda'] as const;

export function ChannelsView({ data, locale }: { data: ChannelsData; locale: string }) {
  const t = pickChannelsCopy(locale);
  const router = useRouter();
  const act = useAction(t.errors);
  const [note, setNote] = useState<string | null>(null);
  const [channel, setChannel] = useState<(typeof CHANNELS)[number]>('booking_com');
  const [copied, setCopied] = useState<string | null>(null);

  const done = (msg: string) => {
    setNote(msg);
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHero
        eyebrow={t.eyebrow}
        title={t.title}
        subtitle={t.subtitle}
        actions={
          <>
            <Button variant="secondary" className="border-white/20 bg-transparent text-limestone-50 hover:bg-white/10" disabled={act.pending} onClick={() => act.run(() => pushAvailability(), (r) => done(t.pushResult(r)))}>
              <Send /> {t.push}
            </Button>
            <Button className="bg-limestone-50 text-ionian-950" disabled={act.pending} onClick={() => act.run(() => syncAllMappings(), (r) => done(t.syncResult(r)))}>
              <RefreshCw className={cn(act.pending && 'animate-spin')} /> {t.syncAll}
            </Button>
          </>
        }
      />

      {(note || act.message) && (
        <p className={cn('animate-fade-up mt-4 rounded-lg px-4 py-3 text-sm', act.message ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success')}>{act.message ?? note}</p>
      )}

      <section className="mt-8">
        <h2 className="font-display text-3xl">{t.sections.feeds}</h2>
        <p className="mt-1 text-sm text-muted">{t.sections.feedsHint}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {CHANNELS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setChannel(c)}
              className={cn('inline-flex h-9 items-center gap-2 rounded-full border px-4 text-sm', channel === c ? 'border-transparent bg-ionian-900 text-limestone-50' : 'border-border-strong text-muted hover:bg-surface-2')}
            >
              <span className="size-2 rounded-full" style={{ background: SOURCE_COLOR[c] }} />
              {t.channel[c]}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {data.types.map((type) => {
            const m = data.mappings.find((x) => x.channel === channel && x.roomTypeId === type.id);
            return <MappingCard key={`${channel}-${type.id}-${m?.icalImportUrl ?? ''}`} type={type} channel={channel} mapping={m} t={t} locale={locale} onDone={done} />;
          })}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-3xl">{t.sections.exports}</h2>
        <p className="mt-1 text-sm text-muted">{t.sections.exportsHint}</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {data.exports.map((r) => (
            <div key={r.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2">
              <span className="w-12 font-serif text-2xl tabular-nums">{r.number}</span>
              <code className="min-w-0 flex-1 truncate text-[11px] text-subtle">{r.url}</code>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  void navigator.clipboard.writeText(r.url);
                  setCopied(r.id);
                  window.setTimeout(() => setCopied(null), 1500);
                }}
              >
                {copied === r.id ? <Check /> : <Copy />} {copied === r.id ? t.copied : t.copy}
              </Button>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-3xl">{t.sections.integrations}</h2>
        <p className="mt-1 text-sm text-muted">{t.sections.integrationsHint}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.integrations.map((i) => (
            <div key={i.provider} className="rounded-xl border border-border bg-surface p-4 shadow-soft">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium">{t.providerName[i.provider]}</p>
                <Badge tone={i.mode === 'live' ? 'success' : i.mode === 'sandbox' ? 'info' : 'neutral'} dot>{t.mode[i.mode]}</Badge>
              </div>
              <p className="mt-1 text-xs text-subtle">
                {t.lastSync}: {i.lastSyncAt ? relativeTime(new Date(i.lastSyncAt), locale) : t.never}
              </p>
              {i.lastError && <p className="mt-1 truncate text-xs text-danger">{i.lastError}</p>}
              {!i.envReady && <p className="mt-1 text-xs text-accent">{t.needsKey}</p>}
              <div className="mt-3 flex items-center gap-1.5">
                {(['mock', 'sandbox', 'live'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    disabled={act.pending}
                    onClick={() => act.run(() => setIntegration({ provider: i.provider, mode, enabled: i.enabled }), () => done(t.saved))}
                    className={cn('h-7 flex-1 rounded-md border text-[11px]', i.mode === mode ? 'border-ionian-700 bg-ionian-800 text-limestone-50' : 'border-border-strong text-muted hover:bg-surface-2')}
                  >
                    {t.mode[mode]}
                  </button>
                ))}
              </div>
              <label className="mt-3 flex items-center gap-2 text-xs text-muted">
                <input type="checkbox" checked={i.enabled} onChange={(e) => act.run(() => setIntegration({ provider: i.provider, mode: i.mode, enabled: e.target.checked }), () => done(t.saved))} />
                {t.enabled}
              </label>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12 mb-8">
        <h2 className="font-display text-3xl">{t.sections.log}</h2>
        <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-surface">
          {data.log.length === 0 && <li className="px-4 py-6 text-sm text-muted">—</li>}
          {data.log.map((l) => (
            <li key={l.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <Network className="size-4 text-subtle" />
              <span className="font-medium">{t.logAction[l.action] ?? l.action}</span>
              <span className="min-w-0 flex-1 truncate text-xs text-muted">
                {[l.meta.channel && t.channel[String(l.meta.channel)], l.meta.error && String(l.meta.error), l.meta.created !== undefined && `+${l.meta.created}`, l.meta.rows !== undefined && `${l.meta.rows}`].filter(Boolean).join(' · ')}
              </span>
              <span className="text-xs text-subtle">{relativeTime(new Date(l.createdAt), locale)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function MappingCard({
  type,
  channel,
  mapping,
  t,
  locale,
  onDone,
}: {
  type: { id: string; name: string };
  channel: (typeof CHANNELS)[number];
  mapping?: ChannelsData['mappings'][number];
  t: ReturnType<typeof pickChannelsCopy>;
  locale: string;
  onDone: (msg: string) => void;
}) {
  const act = useAction(t.errors);
  const [url, setUrl] = useState(mapping?.icalImportUrl ?? '');
  const [room, setRoom] = useState(mapping?.externalRoomId ?? '');
  const [rate, setRate] = useState(mapping?.externalRatePlanId ?? '');

  return (
    <div className="rounded-xl border border-border bg-surface p-4 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">{type.name}</p>
        <span className="text-[11px] text-subtle">
          {t.lastSync}: {mapping?.lastSyncAt ? relativeTime(new Date(mapping.lastSyncAt), locale) : t.never}
        </span>
      </div>
      <div className="mt-3 space-y-2">
        <Input placeholder={t.feedUrl} value={url} onChange={(e) => setUrl(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder={t.extRoom} value={room} onChange={(e) => setRoom(e.target.value)} />
          <Input placeholder={t.extRate} value={rate} onChange={(e) => setRate(e.target.value)} />
        </div>
      </div>
      {act.message && <p className="mt-2 text-xs text-danger">{act.message}</p>}
      <div className="mt-3 flex gap-2">
        <Button size="sm" disabled={act.pending} onClick={() => act.run(() => saveMapping({ roomTypeId: type.id, channel, icalImportUrl: url, externalRoomId: room, externalRatePlanId: rate }), () => onDone(t.saved))}>
          {t.save}
        </Button>
        {mapping?.icalImportUrl && (
          <Button size="sm" variant="secondary" disabled={act.pending} onClick={() => act.run(() => syncMapping(mapping.id), (r) => onDone(t.syncResult(r)))}>
            <RefreshCw /> {t.sync}
          </Button>
        )}
      </div>
    </div>
  );
}
