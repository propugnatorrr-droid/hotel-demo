'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Camera, Plus, ReceiptText, Search, Sparkles } from 'lucide-react';
import { PageHero } from '@/components/app/page-hero';
import { scanImage } from '@/components/app/image-upload';
import { useAction } from '@/components/app/use-action';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Label } from '@/components/ui/input';
import { DEPARTMENTS, EXPENSE_CATEGORY_DEFS } from '@/config/expenses';
import { formatDay } from '@/lib/dates';
import { formatCurrency, type Currency } from '@/lib/format';
import type { ReceiptData } from '@/lib/ai/ocr';
import { cn } from '@/lib/utils';
import { deleteExpense, getReceiptUrl, saveExpense } from '@/server/actions/expenses';
import type { ExpenseRow } from '@/server/queries/expenses';
import type { MonthRow } from '@/server/queries/finance';
import { pickExpensesCopy } from './copy';

const select = 'h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm';

export function ExpensesView({
  rows, month, dept, q, profit, fx, locale, currency, manager, today,
}: { rows: ExpenseRow[]; month: string; dept: string; q: string; profit: MonthRow[]; fx: number; locale: string; currency: Currency; manager: boolean; today: string }) {
  const t = pickExpensesCopy(locale);
  const router = useRouter();
  const pathname = usePathname();
  const money = (n: number) => formatCurrency(n, currency, locale, 0);
  const [editing, setEditing] = useState<{ row?: ExpenseRow; scan?: { data: ReceiptData | null; receiptPath?: string | null } } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanErr, setScanErr] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const cur = profit.find((p) => p.month === month);
  const max = Math.max(1, ...profit.flatMap((p) => [p.income, p.expenses]));
  const deptEntries = Object.entries(cur?.byDept ?? {}).sort((a, b) => b[1] - a[1]);
  const deptMax = Math.max(1, ...deptEntries.map(([, v]) => v));

  const href = (n: { month?: string; dept?: string }) => {
    const p = new URLSearchParams();
    p.set('month', n.month ?? month);
    if ((n.dept ?? dept) !== 'all') p.set('dept', n.dept ?? dept);
    if (q) p.set('q', q);
    return `${pathname}?${p.toString()}`;
  };

  async function onFile(f: File | undefined) {
    if (!f) return;
    setScanning(true);
    setScanErr(null);
    const res = await scanImage<ReceiptData>('receipt', f);
    setScanning(false);
    if (!res.ok) return setScanErr(t.scanErrors[res.error] ?? t.scanErrors.failed!);
    if (!res.data) setScanErr(t.scanErrors.unread!);
    setEditing({ scan: { data: res.data, receiptPath: res.receiptPath } });
  }

  return (
    <div className="mx-auto max-w-6xl">
      <PageHero
        eyebrow={t.eyebrow}
        title={t.title}
        subtitle={t.subtitle}
        actions={
          <>
            <input ref={file} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
            <Button className="ai-glow text-ionian-950" disabled={scanning} onClick={() => file.current?.click()}><Camera /> {scanning ? t.scanning : t.scan}</Button>
            <Button variant="secondary" className="border-white/20 bg-transparent text-limestone-50 hover:bg-white/10" onClick={() => setEditing({})}><Plus /> {t.add}</Button>
          </>
        }
      />
      {scanErr && <p className="mt-4 rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">{scanErr}</p>}

      <section className="mt-8 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
          <h2 className="font-display text-2xl">{t.profit}</h2>
          <div className="mt-5 flex h-44 items-end gap-3">
            {profit.map((p) => (
              <button key={p.month} type="button" onClick={() => router.push(href({ month: p.month }))} className={cn('group flex flex-1 flex-col items-center gap-1.5 rounded-lg p-1 transition-colors', p.month === month && 'bg-surface-2')}>
                <div className="flex h-32 w-full items-end justify-center gap-1">
                  <div className="w-1/2 max-w-6 rounded-t bg-ionian-500 transition-all group-hover:opacity-80" style={{ height: `${(p.income / max) * 100}%` }} title={`${t.income}: ${money(p.income)}`} />
                  <div className="w-1/2 max-w-6 rounded-t bg-terracotta-400 transition-all group-hover:opacity-80" style={{ height: `${(p.expenses / max) * 100}%` }} title={`${t.expenses}: ${money(p.expenses)}`} />
                </div>
                <span className="text-[10px] text-muted">{formatDay(`${p.month}-01`, locale, { month: 'short' })}</span>
                <span className={cn('text-[11px] font-medium tabular-nums', p.profit >= 0 ? 'text-success' : 'text-danger')}>{money(p.profit)}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-ionian-500" />{t.income}</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-terracotta-400" />{t.expenses}</span>
            <span className="ml-auto text-subtle">{t.profitHint(fx)}</span>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
          <p className="text-xs tracking-wider text-muted uppercase">{t.total}</p>
          <p className="font-serif text-5xl tabular-nums">{money(cur?.expenses ?? 0)}</p>
          {cur && <p className="mt-1 text-xs text-muted">{t.income}: {money(cur.income)} · <span className={cur.profit >= 0 ? 'text-success' : 'text-danger'}>{t.net}: {money(cur.profit)}</span></p>}
          <p className="mt-5 text-[11px] tracking-wider text-subtle uppercase">{t.byDept}</p>
          <ul className="mt-2 space-y-2">
            {deptEntries.map(([d, v]) => (
              <li key={d} className="text-xs"><div className="flex justify-between"><span>{t.dept[d]}</span><span className="tabular-nums">{money(v)}</span></div><div className="mt-1 h-1.5 rounded-full bg-surface-2"><div className="h-full rounded-full bg-terracotta-400" style={{ width: `${(v / deptMax) * 100}%` }} /></div></li>
            ))}
          </ul>
        </div>
      </section>

      <div className="mt-8 flex flex-wrap items-center gap-2">
        <input type="month" value={month} onChange={(e) => e.target.value && router.push(href({ month: e.target.value }))} className="h-9 rounded-full border border-border-strong bg-surface px-3 text-sm" aria-label={t.month} />
        {(['all', ...DEPARTMENTS] as const).map((d) => (
          <button key={d} type="button" onClick={() => router.push(href({ dept: d }))} className={cn('h-8 rounded-full border px-3 text-xs', dept === d ? 'border-transparent bg-ionian-900 text-limestone-50' : 'border-border-strong text-muted hover:bg-surface-2')}>{d === 'all' ? t.all : t.dept[d]}</button>
        ))}
        <form method="get" action={pathname} className="ml-auto flex h-9 w-full items-center gap-2 rounded-full border border-border bg-surface px-3 sm:w-56">
          <input type="hidden" name="month" value={month} />
          <Search className="size-4 text-subtle" />
          <input name="q" defaultValue={q} placeholder={t.search} className="w-full bg-transparent text-sm outline-none" />
        </form>
      </div>

      <ul className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
        {rows.length === 0 && <li className="py-16 text-center font-serif text-xl text-muted">{t.empty}</li>}
        {rows.map((r) => (
          <li key={r.id}>
            <button type="button" onClick={() => setEditing({ row: r })} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2/50">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted"><ReceiptText className="size-5" strokeWidth={1.5} /></span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 truncate text-sm font-medium">{r.supplier}{r.ocr && <Sparkles className="size-3.5 shrink-0 text-accent" />}</span>
                <span className="block truncate text-xs text-muted">{formatDay(r.date, locale, { day: 'numeric', month: 'short' })} · {r.category} · {t.dept[r.department]}</span>
              </span>
              <span className="text-right">
                <span className="block font-medium tabular-nums">{formatCurrency(r.amount, r.currency, locale, r.currency === 'ALL' ? 0 : 2)}</span>
                {r.method && <Badge tone="neutral" className="mt-0.5">{t.methods[r.method]}</Badge>}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {editing && <ExpenseDialog key={editing.row?.id ?? 'new'} editing={editing} today={today} currency={currency} t={t} manager={manager} onClose={() => setEditing(null)} onDone={() => { setEditing(null); router.refresh(); }} />}
    </div>
  );
}

function ExpenseDialog({ editing, today, currency, t, manager, onClose, onDone }: { editing: { row?: ExpenseRow; scan?: { data: ReceiptData | null; receiptPath?: string | null } }; today: string; currency: Currency; t: ReturnType<typeof pickExpensesCopy>; manager: boolean; onClose: () => void; onDone: () => void }) {
  const act = useAction(t.errors);
  const r = editing.row;
  const s = editing.scan?.data;
  const catKey = s?.category ?? 'other';
  const [f, setF] = useState({
    supplierName: r?.supplier ?? s?.supplier ?? '',
    supplierNipt: r?.nipt ?? s?.supplierNipt ?? '',
    invoiceNumber: r?.invoiceNumber ?? s?.invoiceNumber ?? '',
    category: r?.category ?? EXPENSE_CATEGORY_DEFS[catKey]?.sq ?? 'Të tjera',
    department: r?.department ?? EXPENSE_CATEGORY_DEFS[catKey]?.department ?? 'other',
    description: r?.description ?? s?.description ?? '',
    amount: r?.amount ?? s?.total ?? 0,
    vatAmount: r?.vat ?? s?.vat ?? 0,
    currency: (r?.currency ?? s?.currency ?? currency) as Currency,
    expenseDate: r?.date ?? s?.date ?? today,
    paymentMethod: r?.method ?? 'cash',
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel="×" className="max-w-xl">
        <DialogHeader><DialogTitle>{t.form.title}</DialogTitle></DialogHeader>
        {s?.confidence !== undefined && <p className="mb-3 flex items-center gap-2 rounded-lg bg-accent-soft px-3 py-2 text-xs text-foreground"><Sparkles className="size-4 text-accent" />{t.form.aiRead(s.confidence)}</p>}
        <form
          className="grid grid-cols-2 gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            act.run(() => saveExpense({ id: r?.id, ...f, paymentMethod: f.paymentMethod as never, receiptPath: editing.scan?.receiptPath ?? undefined, ocrData: s ? { source: 'ai_ocr', ...s } : undefined, ocrConfidence: s?.confidence }), onDone);
          }}
        >
          <div className="col-span-2"><Label>{t.form.supplier}</Label><Input value={f.supplierName} onChange={(e) => set('supplierName', e.target.value)} required /></div>
          <div><Label>{t.form.nipt}</Label><Input value={f.supplierNipt} onChange={(e) => set('supplierNipt', e.target.value)} /></div>
          <div><Label>{t.form.invoice}</Label><Input value={f.invoiceNumber} onChange={(e) => set('invoiceNumber', e.target.value)} /></div>
          <div><Label>{t.form.category}</Label>
            <input list="cats" className={select} value={f.category} onChange={(e) => set('category', e.target.value)} required />
            <datalist id="cats">{Object.values(EXPENSE_CATEGORY_DEFS).map((c) => <option key={c.sq} value={c.sq} />)}</datalist></div>
          <div><Label>{t.form.department}</Label><select className={select} value={f.department} onChange={(e) => set('department', e.target.value as never)}>{DEPARTMENTS.map((d) => <option key={d} value={d}>{t.dept[d]}</option>)}</select></div>
          <div><Label>{t.form.amount}</Label><Input type="number" step="0.01" min={0} value={f.amount} onChange={(e) => set('amount', Number(e.target.value))} required /></div>
          <div><Label>{t.form.vat}</Label><Input type="number" step="0.01" min={0} value={f.vatAmount} onChange={(e) => set('vatAmount', Number(e.target.value))} /></div>
          <div><Label>{t.form.currency}</Label><select className={select} value={f.currency} onChange={(e) => set('currency', e.target.value as Currency)}>{['ALL', 'EUR', 'USD'].map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><Label>{t.form.date}</Label><Input type="date" value={f.expenseDate} onChange={(e) => set('expenseDate', e.target.value)} required /></div>
          <div className="col-span-2"><Label>{t.form.method}</Label><select className={select} value={f.paymentMethod ?? 'cash'} onChange={(e) => set('paymentMethod', e.target.value as never)}>{Object.entries(t.methods).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="col-span-2"><Label>{t.form.description}</Label><Input value={f.description} onChange={(e) => set('description', e.target.value)} /></div>
          {act.message && <p className="col-span-2 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{act.message}</p>}
          <DialogFooter className="col-span-2">
            {r?.hasReceipt && <Button type="button" variant="ghost" onClick={async () => { const u = await getReceiptUrl(r.id); if (u.ok) window.open(u.data.url, '_blank'); }}>{t.form.receipt}</Button>}
            {r && manager && <Button type="button" variant="ghost" className="text-danger" onClick={() => act.run(() => deleteExpense(r.id), onDone)}>{t.form.delete}</Button>}
            <Button type="button" variant="ghost" onClick={onClose}>{t.form.cancel}</Button>
            <Button type="submit" disabled={act.pending}>{t.form.save}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
