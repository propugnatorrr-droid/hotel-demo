'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Bot, Check, Instagram, MessageCircle, MessagesSquare, Phone, Radio, Send, Sparkles, UserRound } from 'lucide-react';
import { PageHero } from '@/components/app/page-hero';
import { useAction } from '@/components/app/use-action';
import { SOURCE_COLOR } from '@/config/channels';
import { Link as IntlLink } from '@/i18n/navigation';
import { formatDay, relativeTime } from '@/lib/dates';
import { isSupabaseConfigured } from '@/lib/env';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { sendStaffMessage, setConversationState, suggestReply } from '@/server/actions/inbox';
import type { ConversationRow, InboxFilter, Thread } from '@/server/queries/inbox';
import { pickInboxCopy } from './copy';

const CHANNEL_COLOR: Record<string, string> = {
  whatsapp: SOURCE_COLOR.whatsapp,
  instagram: SOURCE_COLOR.instagram,
  messenger: SOURCE_COLOR.messenger,
  web_chat: SOURCE_COLOR.direct,
  voice: SOURCE_COLOR.phone,
  booking_com: SOURCE_COLOR.booking_com,
  airbnb: SOURCE_COLOR.airbnb,
  email: 'var(--color-ch-walkin)',
  sms: 'var(--color-ch-walkin)',
};

function ChannelIcon({ channel, className }: { channel: string; className?: string }) {
  const Icon = channel === 'instagram' ? Instagram : channel === 'voice' ? Phone : channel === 'web_chat' ? MessagesSquare : MessageCircle;
  return <Icon className={className} strokeWidth={1.8} />;
}

const STATUS_TONE: Record<string, string> = {
  ai_handling: 'bg-gold-400/15 text-gold-600 dark:text-gold-400',
  needs_human: 'bg-danger-soft text-danger',
  human_handling: 'bg-ionian-100 text-ionian-800 dark:bg-ionian-900 dark:text-ionian-100',
  resolved: 'bg-surface-2 text-muted',
};

export function InboxView({
  rows, counts, filter, thread, orgId, locale,
}: {
  rows: ConversationRow[];
  counts: Record<InboxFilter, number>;
  filter: InboxFilter;
  thread: Thread | null;
  orgId: string;
  locale: string;
}) {
  const t = pickInboxCopy(locale);
  const router = useRouter();
  const pathname = usePathname();
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = createClient();
    let timer: number | undefined;
    const bump = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => router.refresh(), 300);
    };
    const ch = supabase
      .channel(`inbox-${orgId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `org_id=eq.${orgId}` }, bump)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `org_id=eq.${orgId}` }, bump)
      .subscribe((s) => setLive(s === 'SUBSCRIBED'));
    return () => {
      window.clearTimeout(timer);
      void supabase.removeChannel(ch);
    };
  }, [orgId, router]);

  const href = (next: { filter?: InboxFilter; c?: string | null }) => {
    const p = new URLSearchParams();
    const f = next.filter ?? filter;
    if (f !== 'all') p.set('filter', f);
    if (next.c) p.set('c', next.c);
    const s = p.toString();
    return s ? `${pathname}?${s}` : pathname;
  };

  return (
    <div className="mx-auto max-w-7xl">
      <PageHero
        eyebrow={t.eyebrow}
        title={t.title}
        subtitle={t.subtitle}
        actions={live ? <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs text-ionian-100"><Radio className="size-3.5 animate-pulse text-olive-400" /> {t.live}</span> : null}
      >
        <nav className="relative mt-8 flex flex-wrap gap-2">
          {(['all', 'needs_human', 'ai_handling', 'human_handling', 'resolved'] as const).map((f) => (
            <Link key={f} href={href({ filter: f, c: null })} scroll={false} className={cn('inline-flex h-9 items-center gap-2 rounded-full px-4 text-xs transition-colors', filter === f ? 'bg-limestone-50 font-medium text-ionian-950' : 'bg-white/10 text-ionian-100 hover:bg-white/15')}>
              {t.filters[f]}
              <span className={cn('rounded-full px-1.5 text-[10px] tabular-nums', filter === f ? 'bg-ionian-950/10' : 'bg-white/15', f === 'needs_human' && counts[f] > 0 && filter !== f && 'bg-terracotta-500 text-white')}>{counts[f]}</span>
            </Link>
          ))}
        </nav>
      </PageHero>

      <div className="mt-6 grid gap-4 lg:grid-cols-[22rem_1fr]">
        <aside className={cn('space-y-1.5', thread && 'hidden lg:block')}>
          {rows.length === 0 && <p className="rounded-xl border border-dashed border-border-strong py-14 text-center font-serif text-xl text-muted">{t.empty}</p>}
          {rows.map((r, i) => (
            <Link
              key={r.id}
              href={href({ c: r.id })}
              scroll={false}
              style={{ animationDelay: `${Math.min(i, 10) * 25}ms` }}
              className={cn('animate-fade-up flex gap-3 rounded-xl border bg-surface p-3 transition-all hover:-translate-y-px hover:shadow-soft', thread?.id === r.id ? 'border-ionian-500 shadow-soft' : 'border-border')}
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full text-white" style={{ background: CHANNEL_COLOR[r.channel] }}>
                <ChannelIcon channel={r.channel} className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className={cn('truncate text-sm', r.unread > 0 ? 'font-semibold' : 'font-medium')}>{r.contactName}</span>
                  <span className="shrink-0 text-[10px] text-subtle">{relativeTime(new Date(r.lastAt), locale)}</span>
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted">{r.preview}</span>
                <span className="mt-1.5 flex items-center gap-2">
                  <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium', STATUS_TONE[r.status])}>
                    {r.status === 'ai_handling' && <Bot className="size-3" />}
                    {r.status === 'needs_human' && <span className="size-1.5 animate-pulse rounded-full bg-current" />}
                    {t.status[r.status]}
                  </span>
                  {r.unread > 0 && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-terracotta-500 px-1 text-[10px] font-medium text-white">{r.unread}</span>}
                </span>
              </span>
            </Link>
          ))}
        </aside>

        <section className={cn(!thread && 'hidden lg:block')}>
          {thread ? <ThreadPane key={thread.id} thread={thread} locale={locale} back={href({ c: null })} /> : (
            <div className="bg-qilim grid h-[28rem] place-items-center rounded-2xl border border-dashed border-border-strong text-center">
              <div><Sparkles className="mx-auto size-7 text-accent" strokeWidth={1.4} /><p className="font-display mt-4 text-3xl">{t.pick}</p><p className="mt-1 text-sm text-muted">{t.pickSub}</p></div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ThreadPane({ thread, locale, back }: { thread: Thread; locale: string; back: string }) {
  const t = pickInboxCopy(locale);
  const router = useRouter();
  const act = useAction(t.errors);
  const [text, setText] = useState('');
  const [showTpl, setShowTpl] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const first = thread.guest?.firstName ?? thread.contactName ?? '';

  useEffect(() => end.current?.scrollIntoView({ block: 'end' }), [thread.messages.length]);
  useEffect(() => {
    void setConversationState({ conversationId: thread.id, action: 'read' });
  }, [thread.id]);

  const state = (action: 'take' | 'ai' | 'resolve') => act.run(() => setConversationState({ conversationId: thread.id, action }), () => router.refresh());
  function send() {
    const body = text.trim();
    if (!body) return;
    act.run(() => sendStaffMessage({ conversationId: thread.id, body }), () => { setText(''); router.refresh(); });
  }

  return (
    <div className="flex h-[calc(100dvh-13rem)] min-h-[30rem] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-soft">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Link href={back} scroll={false} className="grid size-8 place-items-center rounded-full hover:bg-surface-2 lg:hidden"><ArrowLeft className="size-4" /></Link>
        <span className="grid size-10 place-items-center rounded-full text-white" style={{ background: CHANNEL_COLOR[thread.channel] }}><ChannelIcon channel={thread.channel} className="size-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{thread.contactName}</p>
          <p className="truncate text-xs text-muted">{t.channel[thread.channel]} · {thread.contactHandle}</p>
        </div>
        <span className={cn('hidden rounded-full px-2.5 py-1 text-[11px] font-medium sm:inline-flex', STATUS_TONE[thread.status])}>{t.status[thread.status]}</span>
        {thread.status !== 'human_handling' && <button type="button" onClick={() => state('take')} disabled={act.pending} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-ionian-900 px-3 text-xs text-limestone-50"><UserRound className="size-3.5" />{t.take}</button>}
        {thread.status === 'human_handling' && <button type="button" onClick={() => state('ai')} disabled={act.pending} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border-strong px-3 text-xs"><Bot className="size-3.5" />{t.giveAi}</button>}
        {thread.status !== 'resolved' && <button type="button" onClick={() => state('resolve')} disabled={act.pending} className="grid size-8 place-items-center rounded-full border border-border-strong hover:bg-surface-2" title={t.resolve}><Check className="size-4" /></button>}
      </header>

      {(thread.guest || thread.booking) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border bg-surface-2/60 px-4 py-2 text-xs text-muted">
          {thread.guest && <span>{t.guest}: <b className="text-foreground">{thread.guest.firstName} {thread.guest.lastName}</b> · {t.stays(thread.guest.stays)}</span>}
          {thread.booking && (
            <IntlLink href={`/app/bookings?b=${thread.booking.id}`} className="inline-flex items-center gap-1 text-foreground hover:underline">
              {t.booking}: {thread.booking.code} · {formatDay(thread.booking.checkIn, locale, { day: 'numeric', month: 'short' })} → {formatDay(thread.booking.checkOut, locale, { day: 'numeric', month: 'short' })} <ArrowUpRight className="size-3" />
            </IntlLink>
          )}
        </div>
      )}

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
        {thread.messages.map((m) => {
          if (m.author === 'system') return <p key={m.id} className="text-center text-[11px] text-subtle">{m.body}</p>;
          const mine = m.direction === 'outbound';
          const img = m.attachments.find((a) => a.type === 'image' && a.url.startsWith('http'));
          const photo = m.attachments.some((a) => a.type === 'image');
          return (
            <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[78%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed', mine ? (m.author === 'ai' ? 'rounded-br-md ai-glow text-foreground' : 'rounded-br-md bg-ionian-900 text-limestone-50') : 'rounded-bl-md bg-surface-2')}>
                {img && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img.url} alt="" className="mb-2 max-h-56 rounded-lg object-cover" />
                )}
                {!img && photo && <p className="mb-1 text-xs italic opacity-70">📷 {t.photo}</p>}
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className={cn('mt-1 flex items-center gap-1 text-[10px]', mine ? 'justify-end opacity-60' : 'text-subtle')}>
                  {m.author === 'ai' && <Bot className="size-3" />}{m.author === 'ai' ? t.aiTag : ''} {new Date(m.createdAt).toLocaleTimeString(locale === 'en' ? 'en-GB' : 'sq-AL', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>

      <footer className="border-t border-border p-3">
        {thread.status === 'ai_handling' && <p className="mb-2 flex items-center gap-1.5 text-xs text-muted"><Bot className="size-3.5 text-accent" /> {t.aiNote}</p>}
        {thread.status === 'human_handling' && <p className="mb-2 text-xs text-muted">{t.humanNote(thread.assigneeName)}</p>}
        {act.message && <p className="mb-2 rounded-md bg-danger-soft px-3 py-1.5 text-xs text-danger">{act.message}</p>}
        {showTpl && (
          <div className="mb-2 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-border p-1.5">
            {thread.templates.map((tp) => (
              <button key={tp.id} type="button" onClick={() => { setText(tp.body.replaceAll('{{name}}', first).replaceAll('{{review_link}}', '').replaceAll('{{check_in}}', thread.booking ? formatDay(thread.booking.checkIn, locale, { day: 'numeric', month: 'long' }) : '')); setShowTpl(false); }} className="block w-full rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-surface-2">
                <b>{tp.name}</b> <span className="text-muted">· {tp.body.slice(0, 70)}…</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(); }}
            rows={2}
            placeholder={t.placeholder}
            className="min-h-11 flex-1 resize-none rounded-xl border border-border-strong bg-surface px-3 py-2 text-sm outline-none focus:border-ionian-400"
          />
          <div className="flex flex-col gap-1.5">
            <button type="button" onClick={send} disabled={act.pending || !text.trim()} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ionian-900 px-4 text-xs text-limestone-50 disabled:opacity-40"><Send className="size-3.5" />{t.send}</button>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            disabled={act.pending}
            onClick={() => act.run(() => suggestReply({ conversationId: thread.id, locale }), (r) => setText(r.text))}
            className="ai-glow inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium"
          >
            <Sparkles className="size-3.5" /> {act.pending ? t.suggesting : t.suggest}
          </button>
          <button type="button" onClick={() => setShowTpl((v) => !v)} className="h-8 rounded-full px-3 text-xs text-muted hover:bg-surface-2">{t.templates}</button>
        </div>
      </footer>
    </div>
  );
}
