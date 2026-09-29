'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Plus, Printer, QrCode, Search, ShieldCheck } from 'lucide-react';
import { PageHero } from '@/components/app/page-hero';
import { useAction } from '@/components/app/use-action';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Label } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { formatDay } from '@/lib/dates';
import { formatCurrency, type Currency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { cancelInvoice, closeShift, fiscalizeInvoiceAction, issueInvoice, openShift } from '@/server/actions/invoices';
import type { CashData, InvoiceDetail, Invoiceable, InvoiceRow } from '@/server/queries/invoices';
import { pickInvoicesCopy } from './copy';

const FILTERS = ['all', 'fiscalized', 'issued', 'failed', 'cancelled'] as const;
const TONE: Record<string, 'success' | 'info' | 'danger' | 'neutral'> = { fiscalized: 'success', issued: 'info', failed: 'danger', cancelled: 'neutral', draft: 'neutral' };
const select = 'h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm';

export function InvoicesView({
  tab, rows, counts, filter, q, detail, invoiceable, cash, locale, currency, manager,
}: {
  tab: 'invoices' | 'cash'; rows: InvoiceRow[]; counts: Record<(typeof FILTERS)[number], number>; filter: string; q: string;
  detail: InvoiceDetail | null; invoiceable: Invoiceable; cash: CashData; locale: string; currency: Currency; manager: boolean;
}) {
  const t = pickInvoicesCopy(locale);
  const router = useRouter();
  const pathname = usePathname();
  const [creating, setCreating] = useState(false);
  const money = (n: number) => formatCurrency(n, currency, locale, 2);
  const href = (n: { tab?: string; filter?: string; i?: string | null }) => {
    const p = new URLSearchParams();
    const tb = n.tab ?? tab;
    if (tb !== 'invoices') p.set('tab', tb);
    const f = n.filter ?? filter;
    if (f !== 'all') p.set('filter', f);
    if (q) p.set('q', q);
    if (n.i) p.set('i', n.i);
    const s = p.toString();
    return s ? `${pathname}?${s}` : pathname;
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHero
        eyebrow={t.eyebrow}
        title={t.title}
        subtitle={t.subtitle}
        actions={tab === 'invoices' ? <Button className="bg-limestone-50 text-ionian-950" onClick={() => setCreating(true)}><Plus /> {t.newInvoice}</Button> : null}
      >
        <nav className="relative mt-8 flex flex-wrap gap-2">
          {(['invoices', 'cash'] as const).map((k) => (
            <Link key={k} href={href({ tab: k, i: null })} scroll={false} className={cn('inline-flex h-9 items-center rounded-full px-4 text-xs', tab === k ? 'bg-limestone-50 font-medium text-ionian-950' : 'bg-white/10 text-ionian-100 hover:bg-white/15')}>{t.tabs[k]}</Link>
          ))}
        </nav>
      </PageHero>

      {tab === 'invoices' ? (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {FILTERS.map((f) => (
              <Link key={f} href={href({ filter: f, i: null })} scroll={false} className={cn('inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs', filter === f ? 'border-transparent bg-ionian-900 text-limestone-50' : 'border-border-strong text-muted hover:bg-surface-2')}>
                {t.filters[f]} <span className="tabular-nums opacity-70">{counts[f]}</span>
              </Link>
            ))}
            <form method="get" action={pathname} className="ml-auto flex h-9 w-full items-center gap-2 rounded-full border border-border bg-surface px-3 sm:w-64">
              {filter !== 'all' && <input type="hidden" name="filter" value={filter} />}
              <Search className="size-4 text-subtle" />
              <input name="q" defaultValue={q} placeholder={t.search} className="w-full bg-transparent text-sm outline-none" />
            </form>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-2/60 text-left text-[11px] tracking-wider text-subtle uppercase">
                <tr><th className="px-4 py-2.5">{t.cols.number}</th><th className="hidden px-4 py-2.5 sm:table-cell">{t.cols.date}</th><th className="px-4 py-2.5">{t.cols.buyer}</th><th className="px-4 py-2.5 text-right">{t.cols.total}</th><th className="px-4 py-2.5">{t.cols.status}</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.length === 0 && <tr><td colSpan={5} className="py-16 text-center font-serif text-xl text-muted">{t.empty}</td></tr>}
                {rows.map((r) => (
                  <tr key={r.id} onClick={() => router.push(href({ i: r.id }), { scroll: false })} className="cursor-pointer transition-colors hover:bg-surface-2/50">
                    <td className="px-4 py-3 font-mono text-xs">{r.number}</td>
                    <td className="hidden px-4 py-3 text-muted sm:table-cell">{formatDay(r.issuedAt.slice(0, 10), locale, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td className="max-w-48 truncate px-4 py-3">{r.buyerName ?? t.anon}</td>
                    <td className="px-4 py-3 text-right font-medium tabular-nums">{money(r.total)}</td>
                    <td className="px-4 py-3"><Badge tone={TONE[r.status]} dot>{t.status[r.status]}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <CashPanel cash={cash} t={t} money={money} locale={locale} onDone={() => router.refresh()} />
      )}

      <Sheet open={Boolean(detail)} onOpenChange={(o) => !o && router.replace(href({ i: null }), { scroll: false })}>
        <SheetContent closeLabel="×" className="max-w-lg overflow-y-auto">{detail && <InvoiceSheet inv={detail} t={t} money={money} locale={locale} manager={manager} onDone={() => router.refresh()} />}</SheetContent>
      </Sheet>
      {creating && <NewInvoice data={invoiceable} t={t} money={money} onClose={() => setCreating(false)} onDone={(id) => { setCreating(false); router.push(href({ i: id })); router.refresh(); }} />}
    </div>
  );
}

function InvoiceSheet({ inv, t, money, locale, manager, onDone }: { inv: InvoiceDetail; t: ReturnType<typeof pickInvoicesCopy>; money: (n: number) => string; locale: string; manager: boolean; onDone: () => void }) {
  const act = useAction(t.errors);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const d = t.detail;
  return (
    <>
      <SheetHeader>
        <SheetTitle className="font-mono text-2xl">#{inv.number}</SheetTitle>
        <div className="flex items-center gap-2"><Badge tone={TONE[inv.status]} dot>{t.status[inv.status]}</Badge><span className="text-xs text-muted">{formatDay(inv.issuedAt.slice(0, 10), locale, { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
      </SheetHeader>
      <div className="space-y-5 p-6 text-sm">
        <div className="grid grid-cols-2 gap-4">
          <div><p className="text-[11px] tracking-wider text-subtle uppercase">{d.seller}</p><p className="mt-1 font-medium">{inv.seller.name}</p><p className="text-xs text-muted">{inv.seller.nipt}</p></div>
          <div><p className="text-[11px] tracking-wider text-subtle uppercase">{d.buyer}</p><p className="mt-1 font-medium">{inv.buyerName ?? t.anon}</p><p className="text-xs text-muted">{inv.buyerNipt}</p></div>
        </div>
        <div className="overflow-hidden rounded-lg border border-border">
          {inv.lines.map((l) => (
            <div key={l.id} className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-0">
              <span className="min-w-0 flex-1 truncate">{l.description}</span>
              <span className="text-xs text-muted tabular-nums">{l.quantity} × {money(l.unitPrice)}</span>
              <span className="w-20 text-right tabular-nums">{money(l.amount)}</span>
            </div>
          ))}
        </div>
        <div className="space-y-1 text-right">
          <p className="text-muted">{d.subtotal}: <span className="tabular-nums">{money(inv.subtotal)}</span></p>
          {inv.vatBreakdown.map((v) => <p key={v.rate} className="text-xs text-muted">{d.vat} {v.rate}%: <span className="tabular-nums">{money(v.vat)}</span></p>)}
          <p className="font-serif text-4xl tabular-nums">{money(inv.total)}</p>
        </div>

        {inv.status === 'fiscalized' && (
          <div className="flex gap-4 rounded-xl border border-success/30 bg-success-soft p-4">
            {inv.qr && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={inv.qr} alt="QR" className="size-28 rounded-lg bg-white p-1" />
            )}
            <div className="min-w-0 space-y-1.5 text-xs">
              <p className="flex items-center gap-1.5 font-medium text-success"><ShieldCheck className="size-4" /> {t.status.fiscalized}</p>
              <p className="break-all"><b>{d.nivf}</b> <code>{inv.nivf}</code></p>
              <p className="break-all"><b>{d.nslf}</b> <code>{inv.nslf}</code></p>
              <p className="text-muted">{d.provider}: {inv.fiscalProvider}</p>
              {inv.fiscalProvider === 'mock' && <p className="text-accent">{d.mockNote}</p>}
            </div>
          </div>
        )}
        {act.message && <p className="rounded-md bg-danger-soft px-3 py-2 text-danger">{act.message}</p>}
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary" size="sm"><a href={`${locale === 'en' ? '/en' : ''}/print/invoice/${inv.id}`} target="_blank" rel="noreferrer"><Printer /> {d.print}</a></Button>
          {['issued', 'failed'].includes(inv.status) && <Button size="sm" disabled={act.pending} onClick={() => act.run(() => fiscalizeInvoiceAction(inv.id), onDone)}><QrCode /> {d.fiscalize}</Button>}
          {manager && inv.status !== 'cancelled' && <Button size="sm" variant="ghost" className="text-danger" onClick={() => setCancelling(true)}>{d.cancel}</Button>}
        </div>
        {inv.status === 'cancelled' && <p className="text-xs text-muted">{inv.cancelReason}</p>}
      </div>
      {cancelling && (
        <Dialog open onOpenChange={(o) => !o && setCancelling(false)}>
          <DialogContent closeLabel="×">
            <DialogHeader><DialogTitle>{d.cancel}</DialogTitle></DialogHeader>
            <Input placeholder={d.reason} value={reason} onChange={(e) => setReason(e.target.value)} />
            <DialogFooter><Button variant="ghost" onClick={() => setCancelling(false)}>{d.close}</Button><Button variant="danger" disabled={reason.trim().length < 3 || act.pending} onClick={() => act.run(() => cancelInvoice({ invoiceId: inv.id, reason }), () => { setCancelling(false); onDone(); })}>{d.confirmCancel}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function NewInvoice({ data, t, money, onClose, onDone }: { data: Invoiceable; t: ReturnType<typeof pickInvoicesCopy>; money: (n: number) => string; onClose: () => void; onDone: (id: string) => void }) {
  const act = useAction(t.errors);
  const [kind, setKind] = useState<'folio' | 'pos'>(data.folios.length ? 'folio' : 'pos');
  const [sourceId, setSourceId] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [buyerNipt, setBuyerNipt] = useState('');
  const [buyerAddress, setBuyerAddress] = useState('');
  const [method, setMethod] = useState('cash');
  const [fiscalize, setFiscalize] = useState(true);
  const empty = data.folios.length === 0 && data.pos.length === 0;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel="×">
        <DialogHeader><DialogTitle>{t.newInvoice}</DialogTitle></DialogHeader>
        {empty ? <p className="py-6 text-center text-muted">{t.nothingToInvoice}</p> : (
          <form className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); act.run(() => issueInvoice({ [kind === 'folio' ? 'folioId' : 'posOrderId']: sourceId, buyerName: buyerName || undefined, buyerNipt: buyerNipt || undefined, buyerAddress: buyerAddress || undefined, paymentMethod: method, fiscalize }), (r) => onDone(r.id)); }}>
            <div className="col-span-2 flex gap-2">
              {(['folio', 'pos'] as const).map((k) => <button key={k} type="button" onClick={() => { setKind(k); setSourceId(''); }} className={cn('h-8 flex-1 rounded-full border text-xs', kind === k ? 'border-transparent bg-ionian-900 text-limestone-50' : 'border-border-strong text-muted')}>{k === 'folio' ? t.fromFolio : t.fromPos}</button>)}
            </div>
            <div className="col-span-2"><Label>{t.source}</Label>
              <select className={select} value={sourceId} onChange={(e) => setSourceId(e.target.value)} required>
                <option value="">{t.pick}</option>
                {kind === 'folio' ? data.folios.map((f) => <option key={f.id} value={f.id}>{f.label}</option>) : data.pos.map((o) => <option key={o.id} value={o.id}>{money(o.total)} · {o.method}</option>)}
              </select></div>
            <div className="col-span-2"><Label>{t.buyerName}</Label><Input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} /></div>
            <div><Label>{t.buyerNipt}</Label><Input value={buyerNipt} onChange={(e) => setBuyerNipt(e.target.value)} /></div>
            <div><Label>{t.method}</Label><select className={select} value={method} onChange={(e) => setMethod(e.target.value)}>{Object.entries(t.methods).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div className="col-span-2"><Label>{t.buyerAddress}</Label><Input value={buyerAddress} onChange={(e) => setBuyerAddress(e.target.value)} /></div>
            <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={fiscalize} onChange={(e) => setFiscalize(e.target.checked)} /> {t.fiscalizeNow}</label>
            {act.message && <p className="col-span-2 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{act.message}</p>}
            <DialogFooter className="col-span-2"><Button type="button" variant="ghost" onClick={onClose}>{t.detail.close}</Button><Button type="submit" disabled={act.pending || !sourceId}>{t.issue}</Button></DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CashPanel({ cash, t, money, locale, onDone }: { cash: CashData; t: ReturnType<typeof pickInvoicesCopy>; money: (n: number) => string; locale: string; onDone: () => void }) {
  const act = useAction(t.errors);
  const [opening, setOpening] = useState(200);
  const [counted, setCounted] = useState('');
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[22rem_1fr]">
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
        <h2 className="font-display text-3xl">{t.cash.title}</h2>
        {cash.open ? (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-muted">{t.cash.since}: {new Date(cash.open.openedAt).toLocaleString(locale === 'en' ? 'en-GB' : 'sq-AL', { dateStyle: 'medium', timeStyle: 'short' })}</p>
            <div className="rounded-xl bg-surface-2 p-4"><p className="text-xs text-muted">{t.cash.running}</p><p className="font-serif text-4xl tabular-nums">{money(cash.open.opening + cash.open.running)}</p></div>
            <div><Label>{t.cash.counted}</Label><Input type="number" step="0.01" min={0} value={counted} onChange={(e) => setCounted(e.target.value)} /></div>
            <div><Label>{t.cash.notes}</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
            {act.message && <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{act.message}</p>}
            <Button className="w-full" disabled={act.pending || counted === ''} onClick={() => act.run(() => closeShift({ shiftId: cash.open!.id, countedCash: Number(counted), notes: notes || undefined }), (r) => { setMsg(t.cash.closed(r.difference)); setCounted(''); onDone(); })}>{t.cash.close}</Button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-muted">{t.cash.noShift}</p>
            <div><Label>{t.cash.opening}</Label><Input type="number" min={0} step="0.01" value={opening} onChange={(e) => setOpening(Number(e.target.value))} /></div>
            {act.message && <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{act.message}</p>}
            <Button className="w-full" disabled={act.pending} onClick={() => act.run(() => openShift({ openingCash: opening }), () => { setMsg(null); onDone(); })}>{t.cash.open}</Button>
          </div>
        )}
        {msg && <p className="mt-3 rounded-md bg-success-soft px-3 py-2 text-sm text-success">{msg}</p>}
      </div>
      <div>
        <h3 className="font-display text-2xl">{t.cash.history}</h3>
        <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {cash.recent.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <div className="min-w-0 flex-1"><p className="font-medium">{s.name}</p><p className="text-xs text-muted">{new Date(s.openedAt).toLocaleString(locale === 'en' ? 'en-GB' : 'sq-AL', { dateStyle: 'medium', timeStyle: 'short' })}</p></div>
              {s.closedAt ? (
                <div className="text-right"><p className="tabular-nums">{money(s.counted ?? 0)}</p><p className={cn('text-xs tabular-nums', Math.abs(s.diff ?? 0) >= 1 ? 'font-medium text-danger' : 'text-muted')}>{t.cash.diff}: {(s.diff ?? 0) > 0 ? '+' : ''}{(s.diff ?? 0).toFixed(2)}</p></div>
              ) : <Badge tone="info" dot>{t.cash.openShift}</Badge>}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
