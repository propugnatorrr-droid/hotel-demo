'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowUp, Sparkles, UserRound, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { pickResortCopy } from './copy';

type Msg = { id: string; author: 'guest' | 'ai' | 'staff' | 'system'; body: string; createdAt?: string };

const STORAGE = 'iliria.chat.session';

export function ConciergeChat({ slug, locale, name }: { slug: string; locale: string; name: string }) {
  const t = pickResortCopy(locale).chat;
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [human, setHuman] = useState(false);
  const last = useRef<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      let id = localStorage.getItem(STORAGE);
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(STORAGE, id);
      }
      setSessionId(id);
    } catch {
      setSessionId(crypto.randomUUID());
    }
  }, []);

  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), [msgs, busy, open]);

  // Poll for staff replies while the panel is open.
  const poll = useCallback(async () => {
    if (!sessionId) return;
    const q = new URLSearchParams({ slug, sessionId });
    if (last.current) q.set('after', last.current);
    const res = await fetch(`/api/chat?${q}`).catch(() => null);
    if (!res?.ok) return;
    const data = (await res.json()) as { status?: string; messages: Msg[] };
    if (data.status && data.status !== 'ai_handling' && data.status !== 'none') setHuman(true);
    if (!data.messages.length) return;
    last.current = data.messages[data.messages.length - 1]!.createdAt ?? last.current;
    setMsgs((cur) => {
      const seen = new Set(cur.map((m) => m.id));
      const fresh = data.messages.filter((m) => !seen.has(m.id) && m.author !== 'guest');
      // Skip AI messages we already appended from the POST response.
      const unseen = fresh.filter((m) => !cur.some((c) => c.author === m.author && c.body === m.body));
      return unseen.length ? [...cur, ...unseen] : cur;
    });
  }, [sessionId, slug]);

  useEffect(() => {
    if (!open || !sessionId) return;
    void poll();
    const i = window.setInterval(() => void poll(), 6000);
    return () => window.clearInterval(i);
  }, [open, sessionId, poll]);

  async function send(message?: string, handoff = false) {
    if (!sessionId || busy) return;
    const body = (message ?? text).trim();
    if (!handoff && !body) return;
    if (!handoff) setMsgs((m) => [...m, { id: `l-${Date.now()}`, author: 'guest', body }]);
    setText('');
    setBusy(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, sessionId, locale, ...(handoff ? { handoff: true } : { message: body }) }),
      });
      const data = (await res.json()) as { reply?: string | null; handoff?: boolean; human?: boolean; booking?: { code: string; url: string } | null; error?: string };
      if (data.reply) setMsgs((m) => [...m, { id: `a-${Date.now()}`, author: 'ai', body: data.reply! }]);
      if (data.booking) setMsgs((m) => [...m, { id: `b-${Date.now()}`, author: 'system', body: data.booking!.url }]);
      if (data.handoff || data.human) setHuman(true);
      if (data.error === 'rate') setMsgs((m) => [...m, { id: `r-${Date.now()}`, author: 'system', body: '…' }]);
    } catch {
      setMsgs((m) => [...m, { id: `e-${Date.now()}`, author: 'system', body: '…' }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-theme="day" className="fixed right-4 bottom-4 z-50 md:right-6 md:bottom-6">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="mb-3 flex h-[min(34rem,calc(100dvh-7rem))] w-[calc(100vw-2rem)] max-w-sm flex-col overflow-hidden rounded-3xl border border-limestone-200 bg-white shadow-float"
          >
            <div className="relative flex items-center gap-3 bg-ionian-950 px-5 py-4 text-limestone-50">
              <div className="ai-glow grid size-9 place-items-center rounded-full text-ionian-950"><Sparkles className="size-4" /></div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{name}</p>
                <p className="text-[11px] text-ionian-200">{human ? '● ' : ''}{t.title}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1.5 hover:bg-white/10" aria-label="close"><X className="size-4" /></button>
            </div>
            <div className="flex-1 space-y-2.5 overflow-y-auto bg-limestone-50 px-4 py-4">
              <Bubble who="ai">{t.hello}</Bubble>
              {msgs.map((m) =>
                m.author === 'system' ? (
                  m.body.startsWith('http') ? (
                    <a key={m.id} href={m.body} className="mx-auto block w-fit rounded-full bg-gold-100 px-4 py-2 text-xs font-medium text-limestone-800 underline">{locale === 'en' ? 'Open your booking' : 'Hap rezervimin'}</a>
                  ) : null
                ) : (
                  <Bubble key={m.id} who={m.author === 'guest' ? 'me' : m.author === 'staff' ? 'staff' : 'ai'}>{m.body}</Bubble>
                ),
              )}
              {busy && <Bubble who="ai"><span className="inline-flex gap-1">{[0, 1, 2].map((i) => <span key={i} className="size-1.5 animate-bounce rounded-full bg-ionian-400" style={{ animationDelay: `${i * 120}ms` }} />)}</span></Bubble>}
              <div ref={end} />
            </div>
            <div className="border-t border-limestone-200 bg-white p-3">
              {!human && (
                <button type="button" onClick={() => void send(undefined, true)} className="mb-2 inline-flex items-center gap-1.5 text-[11px] text-limestone-600 hover:text-ionian-900">
                  <UserRound className="size-3" /> {t.human}
                </button>
              )}
              <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="flex items-center gap-2">
                <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t.placeholder} maxLength={1200} className="h-10 min-w-0 flex-1 rounded-full border border-limestone-300 bg-white px-4 text-sm outline-none focus:border-ionian-400" />
                <button type="submit" disabled={busy || !text.trim()} className="grid size-10 place-items-center rounded-full bg-ionian-900 text-limestone-50 transition-transform hover:-translate-y-0.5 disabled:opacity-40" aria-label={t.send}><ArrowUp className="size-4" /></button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="ai-glow ml-auto flex h-14 items-center gap-2 rounded-full px-5 text-sm font-medium text-ionian-950 shadow-float transition-transform hover:-translate-y-1"
      >
        <Sparkles className="size-4" /> <span className="hidden sm:inline">{t.open}</span>
      </button>
    </div>
  );
}

function Bubble({ who, children }: { who: 'ai' | 'me' | 'staff'; children: React.ReactNode }) {
  return (
    <div className={cn('flex', who === 'me' ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap', who === 'me' ? 'rounded-br-md bg-ionian-900 text-limestone-50' : who === 'staff' ? 'rounded-bl-md bg-gold-100 text-limestone-900' : 'rounded-bl-md border border-limestone-200 bg-white text-ionian-950')}>
        {children}
      </div>
    </div>
  );
}
