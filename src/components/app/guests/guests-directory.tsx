'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Crown, Search } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { formatDay } from '@/lib/dates';
import { formatCurrency, type Currency } from '@/lib/format';
import { cn, localized } from '@/lib/utils';
import { updateGuest } from '@/server/actions/bookings';
import type { GuestDetail, GuestRow } from '@/server/queries/guests';
import { pickCopy } from '../bookings/copy';

const COPY = {
  sq: {
    eyebrow: 'Mysafirët · njohja', title: 'Çdo mysafir, i kujtuar.',
    subtitle: 'Historiku, preferencat dhe vlera e secilit mysafir, nga rezervimet reale.',
    search: 'Kërko emër, email, telefon…', empty: 'Asnjë mysafir.', stays: 'qëndrime', value: 'Vlera totale',
    last: 'Qëndrimi i fundit', never: 'Asnjë qëndrim ende', vip: 'VIP', consent: 'Pranon marketing',
    tags: 'Etiketa (me presje)', notes: 'Shënime të brendshme', save: 'Ruaj', saved: 'U ruajt', history: 'Historiku i qëndrimeve',
  },
  en: {
    eyebrow: 'Guests · recognition', title: 'Every guest, remembered.',
    subtitle: 'History, preferences and value for every guest, from real bookings.',
    search: 'Search name, email, phone…', empty: 'No guests.', stays: 'stays', value: 'Lifetime value',
    last: 'Last stay', never: 'No stays yet', vip: 'VIP', consent: 'Marketing consent',
    tags: 'Tags (comma separated)', notes: 'Internal notes', save: 'Save', saved: 'Saved', history: 'Stay history',
  },
};

const input = 'h-10 w-full rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-border-strong';

export function GuestsDirectory({
  rows, q, detail, locale, currency,
}: { rows: GuestRow[]; q: string; detail: GuestDetail | null; locale: string; currency: Currency }) {
  const c = locale === 'en' ? COPY.en : COPY.sq;
  const b = pickCopy(locale);
  const router = useRouter();
  const pathname = usePathname();
  const money = (n: number) => formatCurrency(n, currency, locale);
  const href = (g?: string) => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (g) p.set('g', g);
    const s = p.toString();
    return s ? `${pathname}?${s}` : pathname;
  };

  return (
    <div className="mx-auto max-w-7xl">
      <section className="relative overflow-hidden rounded-2xl bg-ionian-950 px-6 py-10 text-limestone-50 md:px-10 md:py-14">
        <div className="pointer-events-none absolute -top-32 right-0 size-96 rounded-full bg-gold-400/10 blur-[100px]" />
        <p className="relative text-xs tracking-[0.3em] text-gold-400 uppercase">{c.eyebrow}</p>
        <h1 className="font-display relative mt-4 text-5xl md:text-7xl">{c.title}</h1>
        <p className="relative mt-3 max-w-xl text-sm text-ionian-200">{c.subtitle}</p>
      </section>

      <form method="get" action={pathname} className="mt-6">
        <label className="flex h-11 items-center gap-2 rounded-full border border-border bg-surface px-4">
          <Search className="size-4 text-subtle" />
          <input name="q" defaultValue={q} placeholder={c.search} className="w-full bg-transparent text-sm outline-none" />
        </label>
      </form>

      {rows.length === 0 && <p className="py-20 text-center font-serif text-2xl text-muted">{c.empty}</p>}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => router.push(href(g.id), { scroll: false })}
            className="group rounded-xl border border-border bg-surface p-5 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lift"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex size-12 items-center justify-center rounded-full bg-ionian-100 font-serif text-xl text-ionian-900 dark:bg-ionian-900 dark:text-ionian-100">
                {g.firstName[0]}{g.lastName[0]}
              </div>
              {g.isVip && <span className="inline-flex items-center gap-1 rounded-full bg-gold-400/15 px-2 py-1 text-[11px] text-gold-600 dark:text-gold-400"><Crown className="size-3" /> {c.vip}</span>}
            </div>
            <p className="mt-4 truncate font-medium">{g.firstName} {g.lastName}</p>
            <p className="truncate text-xs text-muted">{g.email ?? g.phone ?? '—'}{g.nationality ? ` · ${g.nationality}` : ''}</p>
            <div className="mt-4 flex items-end justify-between border-t border-border pt-3">
              <span className="text-xs text-muted">{g.stays} {c.stays}{g.lastStay ? ` · ${formatDay(g.lastStay, locale, { month: 'short', year: 'numeric' })}` : ''}</span>
              <span className="font-serif text-xl tabular-nums">{money(g.value)}</span>
            </div>
          </button>
        ))}
      </div>

      <Sheet open={Boolean(detail)} onOpenChange={(o) => !o && router.replace(href(), { scroll: false })}>
        <SheetContent closeLabel={b.close} className="max-w-lg overflow-y-auto">
          {detail && <GuestBody key={detail.id} g={detail} c={c} locale={locale} money={money} bookingsBase={pathname.replace(/\/guests$/, '/bookings')} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function GuestBody({
  g, c, locale, money, bookingsBase,
}: { g: GuestDetail; c: (typeof COPY)['sq']; locale: string; money: (n: number) => string; bookingsBase: string }) {
  const b = pickCopy(locale);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    start(async () => {
      const res = await updateGuest({
        guestId: g.id,
        firstName: f.get('firstName'),
        lastName: f.get('lastName'),
        email: f.get('email') || undefined,
        phone: f.get('phone') || undefined,
        nationality: f.get('nationality') || undefined,
        isVip: f.get('isVip') === 'on',
        marketingConsent: f.get('marketingConsent') === 'on',
        tags: f.get('tags') || undefined,
        notes: f.get('notes') || undefined,
      });
      setMsg(res.ok ? { ok: true, text: c.saved } : { ok: false, text: b.errors[res.error] ?? b.errors.unknown ?? '' });
    });
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">{g.isVip && <Crown className="size-5 text-gold-500" />}{g.firstName} {g.lastName}</SheetTitle>
        <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-border">
          <div className="bg-surface p-3"><p className="text-xs text-muted">{c.stays}</p><p className="font-serif text-2xl">{g.stays}</p></div>
          <div className="bg-surface p-3"><p className="text-xs text-muted">{c.value}</p><p className="font-serif text-2xl tabular-nums">{money(g.value)}</p></div>
        </div>
      </SheetHeader>

      <form onSubmit={submit} className="space-y-3 p-6">
        <div className="grid grid-cols-2 gap-2">
          <input name="firstName" required maxLength={80} defaultValue={g.firstName} className={input} aria-label={b.form.firstName} />
          <input name="lastName" required maxLength={80} defaultValue={g.lastName} className={input} aria-label={b.form.lastName} />
          <input name="email" type="email" maxLength={160} defaultValue={g.email ?? ''} placeholder={b.form.email} className={input} />
          <input name="phone" maxLength={40} defaultValue={g.phone ?? ''} placeholder={b.form.phone} className={input} />
          <input name="nationality" maxLength={56} defaultValue={g.nationality ?? ''} placeholder={b.form.nationality} className={cn(input, 'col-span-2')} />
        </div>
        <input name="tags" maxLength={300} defaultValue={g.tags.join(', ')} placeholder={c.tags} className={input} />
        <textarea name="notes" maxLength={2000} defaultValue={g.notes ?? ''} placeholder={c.notes} className={cn(input, 'h-24 py-2')} />
        <div className="flex gap-5 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" name="isVip" defaultChecked={g.isVip} /> {c.vip}</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="marketingConsent" defaultChecked={g.marketingConsent} /> {c.consent}</label>
        </div>
        {msg && <p role="status" className={cn('rounded-md p-3 text-sm', msg.ok ? 'bg-olive-100 text-olive-700 dark:bg-olive-700/25 dark:text-olive-100' : 'bg-danger-soft text-danger')}>{msg.text}</p>}
        <button disabled={pending} className="h-10 w-full rounded-md bg-primary text-sm text-primary-foreground disabled:opacity-50">{c.save}</button>
      </form>

      <section className="px-6 pb-8">
        <h3 className="mb-3 font-serif text-2xl">{c.history}</h3>
        {g.history.length === 0 && <p className="text-sm text-muted">{c.never}</p>}
        <ul className="divide-y divide-border rounded-xl border border-border">
          {g.history.map((h) => (
            <li key={h.id}>
              <Link href={`${bookingsBase}?view=all&b=${h.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-surface-2">
                <span className="min-w-0 truncate">
                  {formatDay(h.checkIn, locale, { day: 'numeric', month: 'short', year: 'numeric' })}
                  <span className="ml-2 text-xs text-muted">{localized(h.typeName, locale)} · {b.status[h.status]}</span>
                </span>
                <span className="tabular-nums">{money(h.total)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
