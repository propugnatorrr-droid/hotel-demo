'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { ArrowDownLeft, ArrowUpRight, RefreshCw, Sparkles, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SOURCE_COLOR, type BookingSource } from '@/config/channels';
import { formatDay, relativeTime } from '@/lib/dates';
import { formatCurrency, type Currency } from '@/lib/format';
import { cn, localized } from '@/lib/utils';
import { saveChannelConnection, saveChannelMapping, simulateBooking, syncChannels } from '@/server/actions/channels';
import type { ChannelsOverview } from '@/server/queries/channels';
import { pickCopy as pickBookingCopy } from '../bookings/copy';
import { useLiveRefresh } from '../calendar/use-live-refresh';

const copy = {
  sq: {
    eyebrow: 'Kanalet · Booking.com · Airbnb · Expedia',
    title: 'Një inventar. Çdo kanal.',
    subtitle: 'Çdo rezervim, çmim dhe dhomë e mbyllur sinkronizohet vetë. Pa mbirezervime, pa kopjim me dorë.',
    mode: { mock: 'Demo', sandbox: 'Sandbox', live: 'Live' },
    lastSync: 'Sinkronizimi i fundit',
    never: 'asnjëherë',
    sync: 'Sinkronizo tani',
    synced: 'Gjithçka u sinkronizua.',
    simulate: 'Simulo rezervim',
    simulated: 'Rezervim i ri erdhi nga kanali. Shiko kalendarin.',
    activity: 'Aktiviteti live',
    empty: 'Ende asnjë aktivitet. Bëj një rezervim ose sinkronizo.',
    kinds: {
      availability: 'Disponueshmëria u dërgua', restrictions: 'Çmimet dhe rregullat u dërguan',
      booking_new: 'Rezervim i ri', booking_modified: 'Rezervim i ndryshuar', booking_cancelled: 'Rezervim i anuluar',
    } as Record<string, string>,
    to: 'te',
    overbooked: 'Mbirezervim: shiko njoftimin kritik',
    open: 'Hap',
    insightTitle: 'Komisionet · 90 ditë',
    insight: (c: string, share: number, s: string) =>
      `Paguat ${c} komision. ${share}% e të ardhurave vijnë nga OTA. Nëse 1 në 5 mysafirë do rezervonte direkt, do kursenit ${s}.`,
    mix: 'Burimet e rezervimeve',
    connection: 'Lidhja me Channex',
    connectionHint: 'Demo punon pa çelës. Për sandbox/live vendos CHANNEX_API_KEY në Vercel dhe ID-në e pronës.',
    propertyId: 'Channex Property ID',
    save: 'Ruaj',
    saved: 'U ruajt.',
    mapping: 'Lidhja e llojeve të dhomave',
    roomId: 'Channex Room Type ID',
    rateId: 'Channex Rate Plan ID',
    webhook: 'Webhook-u nuk është konfiguruar (CHANNEX_WEBHOOK_SECRET). Rezervimet merren nga cron-i ose butoni.',
    errors: {
      module: 'Moduli është i çaktivizuar.', forbidden: 'Kërkon leje menaxheri.', invalid: 'Kontrollo fushat.',
      noKey: 'Mungon CHANNEX_API_KEY në server.', propertyId: 'Property ID duhet të jetë UUID.', soldOut: 'Nuk ka dhoma të lira për simulim.',
      unmapped: 'Lloji i dhomës nuk është i lidhur.', unauthorized: 'Çelësi i Channex është i gabuar.', rateLimited: 'Channex: shumë kërkesa, provo pas 1 minute.',
      network: 'Channex nuk përgjigjet.', pushFailed: 'Dërgimi te kanalet dështoi. Shiko aktivitetin.', unknown: 'Diçka shkoi keq.',
    } as Record<string, string>,
  },
  en: {
    eyebrow: 'Channels · Booking.com · Airbnb · Expedia',
    title: 'One inventory. Every channel.',
    subtitle: 'Every booking, price and closed room syncs by itself. No overbookings, no copy-paste.',
    mode: { mock: 'Demo', sandbox: 'Sandbox', live: 'Live' },
    lastSync: 'Last sync',
    never: 'never',
    sync: 'Sync now',
    synced: 'Everything synced.',
    simulate: 'Simulate booking',
    simulated: 'A new booking arrived from the channel. Check the calendar.',
    activity: 'Live activity',
    empty: 'No activity yet. Make a booking or sync.',
    kinds: {
      availability: 'Availability sent', restrictions: 'Rates & rules sent',
      booking_new: 'New booking', booking_modified: 'Booking modified', booking_cancelled: 'Booking cancelled',
    } as Record<string, string>,
    to: 'to',
    overbooked: 'Overbooking: see the critical alert',
    open: 'Open',
    insightTitle: 'Commissions · 90 days',
    insight: (c: string, share: number, s: string) =>
      `You paid ${c} in commission. ${share}% of revenue comes from OTAs. If 1 in 5 guests booked direct, you'd save ${s}.`,
    mix: 'Booking sources',
    connection: 'Channex connection',
    connectionHint: 'Demo works without a key. For sandbox/live set CHANNEX_API_KEY in Vercel and the property ID.',
    propertyId: 'Channex Property ID',
    save: 'Save',
    saved: 'Saved.',
    mapping: 'Room type mapping',
    roomId: 'Channex Room Type ID',
    rateId: 'Channex Rate Plan ID',
    webhook: 'Webhook not configured (CHANNEX_WEBHOOK_SECRET). Bookings are pulled by cron or the button.',
    errors: {
      module: 'Module disabled.', forbidden: 'Needs manager permission.', invalid: 'Check the fields.',
      noKey: 'CHANNEX_API_KEY is missing on the server.', propertyId: 'Property ID must be a UUID.', soldOut: 'No free rooms to simulate.',
      unmapped: 'Room type is not mapped.', unauthorized: 'Channex key is wrong.', rateLimited: 'Channex: too many requests, retry in 1 minute.',
      network: 'Channex is not responding.', pushFailed: 'Push to channels failed. See activity.', unknown: 'Something went wrong.',
    } as Record<string, string>,
  },
};

const card = 'rounded-2xl border border-border bg-surface p-6 shadow-soft';
const field = 'h-10 w-full min-w-0 rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-border-strong';

type Props = { data: ChannelsOverview; locale: string; currency: Currency };

export function ChannelsWorkspace({ data, locale, currency }: Props) {
  const t = locale === 'en' ? copy.en : copy.sq;
  const bt = pickBookingCopy(locale);
  const pathname = usePathname();
  const live = useLiveRefresh(data.orgId, ['channel_events', 'bookings']);
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [simChannel, setSimChannel] = useState<'booking_com' | 'airbnb' | 'expedia'>('booking_com');
  const [mode, setMode] = useState(data.mode.configured);
  const [propertyId, setPropertyId] = useState(data.propertyId);
  const money = (n: number) => formatCurrency(n, currency, locale);
  const srcLabel = (s: string) => bt.source[s as BookingSource] ?? s;
  const bookingHref = (id: string) => `${pathname.replace(/\/channels$/, '/bookings')}?view=all&b=${id}`;

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  function act<T>(fn: () => Promise<{ ok: true; data: T } | { ok: false; error: string }>, okText: string) {
    start(async () => {
      const res = await fn();
      setToast(res.ok ? { ok: true, text: okText } : { ok: false, text: t.errors[res.error] ?? t.errors.unknown! });
    });
  }

  const channexMaps = new Map(data.maps.filter((m) => m.channel === 'channex').map((m) => [m.roomTypeId, m]));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="relative overflow-hidden rounded-2xl bg-ionian-950 px-6 py-10 text-limestone-50 md:px-10">
        <div className="pointer-events-none absolute -top-40 -right-20 size-[28rem] rounded-full bg-ionian-500/25 blur-[100px]" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs tracking-[0.3em] text-gold-400 uppercase">{t.eyebrow}</p>
            <h1 className="font-display mt-4 text-5xl tracking-tight md:text-6xl">{t.title}</h1>
            <p className="mt-3 max-w-xl text-sm text-limestone-200">{t.subtitle}</p>
          </div>
          <div className="flex flex-col items-end gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs">
              <span className={cn('size-2 rounded-full', live ? 'animate-pulse bg-olive-400' : 'bg-limestone-400')} />
              {t.mode[data.mode.effective === 'channex' ? data.mode.configured : 'mock']} · {t.lastSync}{' '}
              {data.lastSyncAt ? relativeTime(new Date(data.lastSyncAt), locale) : t.never}
            </span>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" disabled={pending} onClick={() => act(() => syncChannels(), t.synced)}>
                <RefreshCw className={cn(pending && 'animate-spin')} /> {t.sync}
              </Button>
              {data.mode.effective === 'mock' && (
                <div className="flex items-center gap-1 rounded-md bg-white/10 p-1">
                  <select
                    className="h-7 rounded bg-transparent px-2 text-xs outline-none"
                    value={simChannel}
                    onChange={(e) => setSimChannel(e.target.value as typeof simChannel)}
                  >
                    {(['booking_com', 'expedia', 'airbnb'] as const).map((c) => (
                      <option key={c} value={c} className="text-foreground">{srcLabel(c)}</option>
                    ))}
                  </select>
                  <Button variant="ai" size="sm" disabled={pending} onClick={() => act(() => simulateBooking({ channel: simChannel }), t.simulated)}>
                    <Sparkles /> {t.simulate}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
        {data.lastError && (
          <p className="relative mt-6 inline-flex items-center gap-2 rounded-lg bg-danger/20 px-3 py-2 text-xs">
            <TriangleAlert className="size-4" /> {t.errors[data.lastError] ?? data.lastError}
          </p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className={card}>
          <h2 className="font-display text-2xl">{t.activity}</h2>
          {data.events.length === 0 ? (
            <p className="mt-6 text-sm text-muted">{t.empty}</p>
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {data.events.map((e) => {
                const s = e.summary as Record<string, unknown>;
                const warnings = (s.warnings as string[] | undefined) ?? [];
                const pull = e.direction === 'pull';
                const channel = String(s.channel ?? '');
                return (
                  <li key={e.id} className="flex items-start gap-3 py-3 text-sm">
                    <span
                      className={cn(
                        'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full',
                        e.status === 'error' ? 'bg-danger-soft text-danger' : pull ? 'bg-olive-100 text-olive-700' : 'bg-ionian-100 text-ionian-800',
                      )}
                    >
                      {pull ? <ArrowDownLeft className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">
                        {t.kinds[e.kind] ?? e.kind}
                        {pull && channel && (
                          <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-muted">
                            <span className="size-2 rounded-sm" style={{ background: SOURCE_COLOR[channel as BookingSource] }} />
                            {srcLabel(channel)}
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {pull
                          ? `${s.guest ?? ''} · ${formatDay(String(s.checkIn), locale, { day: 'numeric', month: 'short' })} – ${formatDay(String(s.checkOut), locale, { day: 'numeric', month: 'short' })} · ${money(Number(s.amount ?? 0))}`
                          : `${t.to} ${((s.channels as string[] | undefined) ?? []).map(srcLabel).join(', ') || 'Channex'} · ${s.ranges ?? 0} ranges`}
                      </p>
                      {warnings.includes('overbooked') && <p className="mt-1 text-xs text-danger">{t.overbooked}</p>}
                      {e.error && <p className="mt-1 text-xs text-danger">{t.errors[e.error] ?? e.error}</p>}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-subtle">
                      {relativeTime(new Date(e.createdAt), locale)}
                      {e.bookingId && (
                        <Link href={bookingHref(e.bookingId)} className="text-ionian-600 hover:underline">{t.open}</Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="space-y-6">
          <section className={cn(card, 'ai-glow')}>
            <p className="text-xs tracking-[0.2em] text-gold-600 uppercase">{t.insightTitle}</p>
            <p className="mt-3 font-serif text-xl leading-snug">
              {t.insight(money(data.insight.otaCommission), data.insight.otaShare, money(data.insight.savings))}
            </p>
            <h3 className="mt-6 text-xs text-muted">{t.mix}</h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              {data.mix.map((m) => (
                <li key={m.source} className="flex items-center gap-2">
                  <span className="size-2.5 rounded-sm" style={{ background: SOURCE_COLOR[m.source] }} />
                  <span className="flex-1">{srcLabel(m.source)}</span>
                  <span className="text-muted tabular-nums">{m.count}</span>
                  <span className="w-24 text-right tabular-nums">{money(m.revenue)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className={card}>
            <h2 className="font-display text-2xl">{t.connection}</h2>
            <p className="mt-1 text-xs text-muted">{t.connectionHint}</p>
            <div className="mt-4 grid grid-cols-3 gap-1 rounded-full bg-surface-2 p-1 text-xs">
              {(['mock', 'sandbox', 'live'] as const).map((m) => (
                <button key={m} type="button" onClick={() => setMode(m)} className={cn('rounded-full py-2', mode === m ? 'bg-surface font-medium shadow-soft' : 'text-muted')}>
                  {t.mode[m]}
                </button>
              ))}
            </div>
            {mode !== 'mock' && (
              <input className={cn(field, 'mt-3 font-mono text-xs')} placeholder={t.propertyId} value={propertyId} onChange={(e) => setPropertyId(e.target.value)} />
            )}
            <Button className="mt-3 w-full" size="sm" disabled={pending} onClick={() => act(() => saveChannelConnection({ mode, propertyId }), t.saved)}>
              {t.save}
            </Button>
            {mode !== 'mock' && !data.webhookReady && <p className="mt-3 text-xs text-gold-600">{t.webhook}</p>}
          </section>
        </div>
      </div>

      {data.mode.configured !== 'mock' && (
        <section className={card}>
          <h2 className="font-display text-2xl">{t.mapping}</h2>
          <div className="mt-4 space-y-3">
            {data.types.map((ty) => (
              <MappingRow key={ty.id} name={localized(ty.name, locale)} initial={channexMaps.get(ty.id)} t={t} pending={pending}
                onSave={(room, rate) => act(() => saveChannelMapping({ roomTypeId: ty.id, externalRoomId: room, externalRatePlanId: rate }), t.saved)} />
            ))}
          </div>
        </section>
      )}

      {toast && (
        <div role="status" className={cn('animate-fade-up fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full px-5 py-2.5 text-sm shadow-float', toast.ok ? 'bg-ionian-950 text-limestone-50' : 'bg-danger text-white')}>
          {toast.text}
        </div>
      )}
    </div>
  );
}

function MappingRow({
  name, initial, t, pending, onSave,
}: {
  name: string;
  initial?: { externalRoomId: string | null; externalRatePlanId: string | null };
  t: (typeof copy)['sq'];
  pending: boolean;
  onSave: (room: string, rate: string) => void;
}) {
  const [room, setRoom] = useState(initial?.externalRoomId ?? '');
  const [rate, setRate] = useState(initial?.externalRatePlanId ?? '');
  return (
    <div className="grid items-center gap-2 md:grid-cols-[180px_1fr_1fr_auto]">
      <span className="text-sm font-medium">{name}</span>
      <input className={cn(field, 'font-mono text-xs')} placeholder={t.roomId} value={room} onChange={(e) => setRoom(e.target.value)} />
      <input className={cn(field, 'font-mono text-xs')} placeholder={t.rateId} value={rate} onChange={(e) => setRate(e.target.value)} />
      <Button size="sm" variant="secondary" disabled={pending} onClick={() => onSave(room, rate)}>{t.save}</Button>
    </div>
  );
}
