'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BedDouble, Banknote, CreditCard, Minus, Package, Plus, Search, Trash2, Users } from 'lucide-react';
import { PageHero } from '@/components/app/page-hero';
import { useAction } from '@/components/app/use-action';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { formatCurrency, type Currency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { adjustStock, findInHouse, payOrder, saveOrder, voidOrder } from '@/server/actions/pos';
import type { PosData } from '@/server/queries/pos';
import { pickPosCopy } from './copy';

type Line = { productId: string; name: string; price: number; quantity: number };

export function PosTerminal({ data, locale, currency, manager }: { data: PosData; locale: string; currency: Currency; manager: boolean }) {
  const t = pickPosCopy(locale);
  const router = useRouter();
  const act = useAction(t.errors);
  const money = (n: number) => formatCurrency(n, currency, locale, 2);

  const [tableId, setTableId] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | undefined>();
  const [cart, setCart] = useState<Line[]>([]);
  const [covers, setCovers] = useState(2);
  const [discount, setDiscount] = useState(0);
  const [cat, setCat] = useState<string | 'all'>('all');
  const [paying, setPaying] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [showStock, setShowStock] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const outlet = data.outlet;
  const orderByTable = useMemo(() => new Map(data.orders.filter((o) => o.tableId).map((o) => [o.tableId!, o])), [data.orders]);

  // Reset the working order whenever the outlet changes.
  useEffect(() => {
    setTableId(null); setOrderId(undefined); setCart([]); setDiscount(0);
  }, [outlet?.id]);

  function load(tid: string | null, orderIdOverride?: string) {
    const o = orderIdOverride ? data.orders.find((x) => x.id === orderIdOverride) : tid ? orderByTable.get(tid) : undefined;
    setTableId(tid);
    setOrderId(o?.id);
    setCovers(o?.covers ?? 2);
    setDiscount(o && o.subtotal > 0 ? Math.round((o.discount / o.subtotal) * 100) : 0);
    setCart(o ? o.items.filter((i) => i.productId).map((i) => ({ productId: i.productId!, name: i.name, price: i.unitPrice, quantity: i.quantity })) : []);
  }

  const subtotal = cart.reduce((s, l) => s + l.price * l.quantity, 0);
  const total = subtotal - (subtotal * discount) / 100;

  function add(p: PosData['products'][number]) {
    setCart((c) => {
      const i = c.findIndex((l) => l.productId === p.id);
      if (i >= 0) return c.map((l, k) => (k === i ? { ...l, quantity: l.quantity + 1 } : l));
      return [...c, { productId: p.id, name: p.name, price: p.price, quantity: 1 }];
    });
  }
  const step = (id: string, d: number) => setCart((c) => c.flatMap((l) => (l.productId !== id ? [l] : l.quantity + d <= 0 ? [] : [{ ...l, quantity: l.quantity + d }])));

  const payload = (send: boolean) => ({ orderId, outletId: outlet!.id, tableId, covers: tableId ? covers : undefined, items: cart.map((l) => ({ productId: l.productId, quantity: l.quantity })), discountPct: discount, send });

  function save(send: boolean) {
    act.run(() => saveOrder(payload(send)), (r) => {
      setOrderId(r.orderId);
      setFlash(send ? t.sent : t.saved);
      window.setTimeout(() => setFlash(null), 2000);
      router.refresh();
    });
  }

  if (!outlet) return <p className="py-20 text-center font-serif text-2xl text-muted">—</p>;

  const shown = data.products.filter((p) => cat === 'all' || p.categoryId === cat);
  const salesTotal = data.summary.reduce((s, r) => s + r.total, 0);
  const salesCount = data.summary.reduce((s, r) => s + r.n, 0);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHero
        eyebrow={t.eyebrow}
        title={t.title}
        subtitle={t.subtitle}
        actions={
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-white/10 px-4 py-2 text-right">
              <p className="text-[10px] tracking-wider text-ionian-200 uppercase">{t.today} · {t.sales}</p>
              <p className="font-serif text-2xl tabular-nums">{money(salesTotal)} <span className="font-sans text-xs text-ionian-200">{salesCount} {t.orders}</span></p>
            </div>
            <Button variant="secondary" className="border-white/20 bg-transparent text-limestone-50 hover:bg-white/10" onClick={() => setShowStock(true)}><Package /> {t.stock}</Button>
          </div>
        }
      >
        <nav className="relative mt-8 flex flex-wrap gap-2">
          {data.outlets.map((o) => (
            <Link key={o.id} href={`?outlet=${o.id}`} scroll={false} className={cn('inline-flex h-9 items-center rounded-full px-4 text-xs transition-colors', o.id === outlet.id ? 'bg-limestone-50 font-medium text-ionian-950' : 'bg-white/10 text-ionian-100 hover:bg-white/15')}>{o.name}</Link>
          ))}
        </nav>
      </PageHero>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-4">
          {/* tables */}
          <div>
            <p className="mb-2 text-xs tracking-wider text-muted uppercase">{t.tables}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => load(null)} className={cn('h-14 rounded-xl border px-4 text-sm', tableId === null && !orderId ? 'border-ionian-600 bg-ionian-800 text-limestone-50' : 'border-border-strong bg-surface hover:bg-surface-2')}>{t.noTable}</button>
              {data.tables.map((tb) => {
                const o = orderByTable.get(tb.id);
                return (
                  <button key={tb.id} type="button" onClick={() => load(tb.id)} className={cn('relative h-14 min-w-20 rounded-xl border px-3 text-left transition-all hover:-translate-y-px', tableId === tb.id ? 'border-ionian-600 bg-ionian-800 text-limestone-50' : o ? 'border-gold-400/60 bg-gold-100 text-limestone-900' : 'border-border-strong bg-surface hover:bg-surface-2')}>
                    <span className="block font-serif text-xl leading-none">{tb.label}</span>
                    <span className="block text-[10px] opacity-70">{o ? `${money(o.total)}` : `${tb.seats} ${t.seats}`}</span>
                    {o && <span className="absolute top-1.5 right-1.5 size-2 animate-pulse rounded-full bg-terracotta-500" />}
                  </button>
                );
              })}
              {data.orders.filter((o) => !o.tableId).map((o) => (
                <button key={o.id} type="button" onClick={() => load(null, o.id)} className={cn('h-14 rounded-xl border px-3 text-left text-xs', orderId === o.id ? 'border-ionian-600 bg-ionian-800 text-limestone-50' : 'border-gold-400/60 bg-gold-100 text-limestone-900')}>
                  <span className="block font-medium">{t.order}</span><span className="opacity-70">{money(o.total)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* menu */}
          <div>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {[{ id: 'all', name: t.all }, ...data.categories].map((c) => (
                <button key={c.id} type="button" onClick={() => setCat(c.id)} className={cn('h-8 rounded-full px-3.5 text-xs', cat === c.id ? 'bg-ionian-900 text-limestone-50' : 'border border-border-strong text-muted hover:bg-surface-2')}>{c.name}</button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {shown.map((p) => {
                const qty = cart.find((l) => l.productId === p.id)?.quantity ?? 0;
                return (
                  <button key={p.id} type="button" onClick={() => add(p)} className={cn('group relative flex min-h-24 flex-col justify-between rounded-xl border bg-surface p-3 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lift active:scale-[0.98]', qty > 0 ? 'border-ionian-500' : 'border-border')}>
                    <span className="line-clamp-2 text-sm font-medium">{p.name}</span>
                    <span className="flex items-end justify-between">
                      <span className="font-serif text-xl tabular-nums">{money(p.price)}</span>
                      {p.low && <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-1.5 py-0.5 text-[10px] text-danger"><AlertTriangle className="size-3" />{p.stockQty}</span>}
                    </span>
                    {qty > 0 && <span className="animate-pulse-land absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-ionian-800 text-xs font-medium text-limestone-50">{qty}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* cart */}
        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-soft">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="font-display text-2xl">{t.order}{tableId ? ` · ${data.tables.find((x) => x.id === tableId)?.label}` : ''}</p>
              {tableId && (
                <label className="flex items-center gap-1.5 text-xs text-muted"><Users className="size-3.5" />
                  <input type="number" min={1} max={40} value={covers} onChange={(e) => setCovers(Math.max(1, Number(e.target.value)))} className="h-7 w-12 rounded-md border border-border-strong bg-surface px-1.5 text-center text-xs" />
                </label>
              )}
            </div>
            <ul className="max-h-[22rem] divide-y divide-border overflow-y-auto">
              {cart.length === 0 && <li className="px-4 py-10 text-center text-sm text-muted">{t.empty}</li>}
              {cart.map((l) => (
                <li key={l.productId} className="flex items-center gap-2 px-4 py-2.5">
                  <div className="min-w-0 flex-1"><p className="truncate text-sm">{l.name}</p><p className="text-xs text-muted">{money(l.price)}</p></div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => step(l.productId, -1)} className="grid size-7 place-items-center rounded-full border border-border-strong hover:bg-surface-2"><Minus className="size-3" /></button>
                    <span className="w-6 text-center text-sm tabular-nums">{l.quantity}</span>
                    <button type="button" onClick={() => step(l.productId, 1)} className="grid size-7 place-items-center rounded-full border border-border-strong hover:bg-surface-2"><Plus className="size-3" /></button>
                  </div>
                  <span className="w-16 text-right text-sm tabular-nums">{money(l.price * l.quantity)}</span>
                </li>
              ))}
            </ul>
            <div className="space-y-2 border-t border-border bg-surface-2/60 px-4 py-3 text-sm">
              <label className="flex items-center justify-between gap-2 text-xs text-muted">
                <span>{t.discount} <span className="text-subtle">({t.discountHint(15)})</span></span>
                <input type="number" min={0} max={100} value={discount} onChange={(e) => setDiscount(Math.min(100, Math.max(0, Number(e.target.value))))} className="h-7 w-16 rounded-md border border-border-strong bg-surface px-2 text-right text-xs" />
              </label>
              <div className="flex justify-between text-muted"><span>{t.subtotal}</span><span className="tabular-nums">{money(subtotal)}</span></div>
              <div className="flex items-baseline justify-between"><span className="font-medium">{t.total}</span><span className="font-serif text-4xl tabular-nums">{money(total)}</span></div>
            </div>
            {(act.message || flash) && <p className={cn('mx-4 mb-2 rounded-md px-3 py-1.5 text-xs', act.message ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success')}>{act.message ?? flash}</p>}
            <div className="grid grid-cols-2 gap-2 p-4 pt-2">
              <Button variant="secondary" disabled={act.pending || cart.length === 0} onClick={() => save(true)}>{t.send}</Button>
              <Button disabled={act.pending || cart.length === 0} onClick={() => act.run(() => saveOrder(payload(false)), (r) => { setOrderId(r.orderId); setPaying(true); })}>{t.pay}</Button>
              {orderId && <Button variant="ghost" size="sm" className="col-span-2 text-danger" onClick={() => setVoiding(true)}><Trash2 /> {t.void}</Button>}
            </div>
          </div>
        </aside>
      </div>

      {paying && orderId && <PayDialog orderId={orderId} total={total} t={t} money={money} onClose={() => setPaying(false)} onPaid={(msg) => { setPaying(false); setCart([]); setOrderId(undefined); setTableId(null); setDiscount(0); setFlash(msg); window.setTimeout(() => setFlash(null), 2500); router.refresh(); }} />}
      {voiding && orderId && <VoidDialog orderId={orderId} t={t} onClose={() => setVoiding(false)} onDone={() => { setVoiding(false); setCart([]); setOrderId(undefined); setTableId(null); router.refresh(); }} />}
      {showStock && <StockDialog stock={data.stock} t={t} manager={manager} onClose={() => setShowStock(false)} />}
    </div>
  );
}

function PayDialog({ orderId, total, t, money, onClose, onPaid }: { orderId: string; total: number; t: ReturnType<typeof pickPosCopy>; money: (n: number) => string; onClose: () => void; onPaid: (msg: string) => void }) {
  const act = useAction(t.errors);
  const [room, setRoom] = useState(false);
  const [q, setQ] = useState('');
  const [guests, setGuests] = useState<{ id: string; room: string; guest: string; code: string }[]>([]);

  useEffect(() => {
    if (!room) return;
    const h = window.setTimeout(async () => {
      const res = await findInHouse(q);
      if (res.ok) setGuests(res.data);
    }, 200);
    return () => window.clearTimeout(h);
  }, [q, room]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel="×">
        <DialogHeader><DialogTitle>{t.payTitle}</DialogTitle><p className="font-serif text-5xl tabular-nums">{money(total)}</p></DialogHeader>
        {!room ? (
          <div className="grid grid-cols-3 gap-2">
            {([['cash', Banknote], ['card', CreditCard], ['room_charge', BedDouble]] as const).map(([m, Icon]) => (
              <button key={m} type="button" disabled={act.pending} onClick={() => (m === 'room_charge' ? setRoom(true) : act.run(() => payOrder({ orderId, method: m }), () => onPaid(t.paid)))} className="flex h-24 flex-col items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface transition-all hover:-translate-y-0.5 hover:bg-surface-2 hover:shadow-soft">
                <Icon className="size-6" strokeWidth={1.5} /><span className="text-sm">{t.method[m]}</span>
              </button>
            ))}
          </div>
        ) : (
          <div>
            <label className="flex h-10 items-center gap-2 rounded-md border border-border-strong px-3"><Search className="size-4 text-subtle" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.roomSearch} className="w-full bg-transparent text-sm outline-none" /></label>
            <ul className="mt-3 max-h-64 space-y-1.5 overflow-y-auto">
              {guests.length === 0 && <li className="py-6 text-center text-sm text-muted">{t.noGuests}</li>}
              {guests.map((g) => (
                <li key={g.id}>
                  <button type="button" disabled={act.pending} onClick={() => act.run(() => payOrder({ orderId, method: 'room_charge', bookingId: g.id }), () => onPaid(t.charged))} className="flex w-full items-center gap-3 rounded-lg border border-border p-2.5 text-left hover:bg-surface-2">
                    <span className="grid size-10 place-items-center rounded-lg bg-ionian-900 font-serif text-lg text-limestone-50">{g.room}</span>
                    <span className="text-sm">{g.guest}<span className="block text-xs text-muted">{g.code}</span></span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {act.message && <p className="mt-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{act.message}</p>}
        <DialogFooter><Button variant="ghost" onClick={room ? () => setRoom(false) : onClose}>{t.cancel}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VoidDialog({ orderId, t, onClose, onDone }: { orderId: string; t: ReturnType<typeof pickPosCopy>; onClose: () => void; onDone: () => void }) {
  const act = useAction(t.errors);
  const [reason, setReason] = useState('');
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel="×">
        <DialogHeader><DialogTitle>{t.void}</DialogTitle></DialogHeader>
        <Input placeholder={t.voidReason} value={reason} onChange={(e) => setReason(e.target.value)} />
        {act.message && <p className="mt-3 text-sm text-danger">{act.message}</p>}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>{t.cancel}</Button>
          <Button variant="danger" disabled={act.pending || reason.trim().length < 3} onClick={() => act.run(() => voidOrder({ orderId, reason }), onDone)}>{t.confirmVoid}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StockDialog({ stock, t, manager, onClose }: { stock: PosData['stock']; t: ReturnType<typeof pickPosCopy>; manager: boolean; onClose: () => void }) {
  const router = useRouter();
  const act = useAction(t.errors);
  void manager;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel="×" className="max-w-xl">
        <DialogHeader><DialogTitle>{t.stockTitle}</DialogTitle></DialogHeader>
        <ul className="max-h-[26rem] divide-y divide-border overflow-y-auto">
          {stock.map((s) => {
            const low = s.threshold !== null && s.qty <= s.threshold;
            return (
              <li key={s.id} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm">{s.name}</span>
                {low && <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[10px] text-danger">{t.low}</span>}
                <span className={cn('w-12 text-right font-serif text-xl tabular-nums', low && 'text-danger')}>{s.qty}</span>
                {[-1, 6, 24].map((d) => (
                  <button key={d} type="button" disabled={act.pending} onClick={() => act.run(() => adjustStock({ productId: s.id, delta: d }), () => router.refresh())} className="h-7 rounded-md border border-border-strong px-2 text-xs hover:bg-surface-2">{d > 0 ? `+${d}` : d}</button>
                ))}
              </li>
            );
          })}
        </ul>
        {act.message && <p className="mt-2 text-sm text-danger">{act.message}</p>}
      </DialogContent>
    </Dialog>
  );
}
