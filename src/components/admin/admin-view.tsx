'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowRight, Banknote, LogIn, Plus } from 'lucide-react';
import { useAction } from '@/components/app/use-action';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Label } from '@/components/ui/input';
import { ALL_MODULES, MODULE_LABELS, PLAN_PRICE_USD, type PlanKey } from '@/config/plans';
import type { ModuleKey } from '@/lib/auth/types';
import { relativeTime } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { createHotel, enterHotel, recordHotelPayment, setHotelPlan, setHotelStatus, toggleHotelModule } from '@/server/actions/admin';
import type { AdminHotel } from '@/server/queries/admin';

const select = 'h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm';
const PLANS: PlanKey[] = ['basic', 'pro', 'premium', 'enterprise'];
const STATUS_TONE: Record<string, 'success' | 'info' | 'danger' | 'neutral' | 'accent'> = { active: 'success', trial: 'info', suspended: 'danger', demo: 'accent' };
const ERR: Record<string, string> = { slugTaken: 'Ky slug ekziston tashmë.', inviteFailed: 'Ftesa dështoi (Supabase).', invalid: 'Kontrollo fushat.', notFound: 'Nuk u gjet.', unknown: 'Diçka shkoi keq.' };

export function AdminView({ hotels, locale }: { hotels: AdminHotel[]; locale: string }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<string | null>(hotels[0]?.id ?? null);
  const active = hotels.find((h) => h.id === open) ?? null;
  const totalMrr = hotels.filter((h) => h.status === 'active' && !h.isDemo).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 md:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs tracking-[0.3em] text-accent uppercase">Iliria · Super admin</p>
          <h1 className="font-display mt-3 text-5xl md:text-6xl">Të gjitha hotelet</h1>
          <p className="mt-2 text-sm text-muted">{hotels.length} hotele · {totalMrr} aktive me pagesë</p>
        </div>
        <Button onClick={() => setCreating(true)}><Plus /> Hotel i ri</Button>
      </header>

      <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_24rem]">
        <ul className="space-y-2">
          {hotels.map((h) => (
            <li key={h.id}>
              <button type="button" onClick={() => setOpen(h.id)} className={cn('flex w-full items-center gap-4 rounded-xl border bg-surface p-4 text-left shadow-soft transition-all hover:-translate-y-px', open === h.id ? 'border-ionian-500' : 'border-border')}>
                <span className="grid size-12 place-items-center rounded-xl bg-ionian-900 font-display text-2xl text-limestone-50">{h.name.slice(0, 1)}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2"><span className="truncate font-medium">{h.name}</span><Badge tone={STATUS_TONE[h.status]} dot>{h.status}</Badge><Badge tone="outline">{h.plan}</Badge></span>
                  <span className="mt-0.5 block truncate text-xs text-muted">{h.city ?? '—'} · {h.rooms} dhoma · {h.users} përdorues · {h.bookings30} rezervime/30d · AI {h.ai30}</span>
                </span>
                <span className="hidden text-right text-xs text-subtle sm:block">{h.lastActivity ? relativeTime(new Date(h.lastActivity), locale) : '—'}<br />{h.billing.paidUntil ? `paguar deri ${h.billing.paidUntil}` : 'pa pagesë'}</span>
              </button>
            </li>
          ))}
        </ul>

        {active && <HotelPanel key={active.id} hotel={active} locale={locale} onDone={() => router.refresh()} onEnter={() => router.push('/app')} />}
      </div>
      {creating && <CreateDialog onClose={() => setCreating(false)} onDone={() => { setCreating(false); router.refresh(); }} />}
    </div>
  );
}

function HotelPanel({ hotel, onDone, onEnter }: { hotel: AdminHotel; locale: string; onDone: () => void; onEnter: () => void }) {
  const act = useAction(ERR);
  const [paying, setPaying] = useState(false);
  const on = new Set(hotel.modules);
  return (
    <aside className="h-fit space-y-5 rounded-2xl border border-border bg-surface p-5 shadow-soft lg:sticky lg:top-4">
      <div>
        <h2 className="font-display text-3xl">{hotel.name}</h2>
        <p className="text-xs text-muted">/r/{hotel.slug}</p>
        <Button className="mt-3 w-full" variant="secondary" disabled={act.pending} onClick={() => act.run(() => enterHotel(hotel.id), onEnter)}><LogIn /> Hyr në panel <ArrowRight /></Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Plani {PLAN_PRICE_USD[hotel.plan as PlanKey] ? `· $${PLAN_PRICE_USD[hotel.plan as PlanKey]}/muaj` : ''}</Label>
          <select className={select} value={hotel.plan} disabled={act.pending} onChange={(e) => act.run(() => setHotelPlan({ orgId: hotel.id, plan: e.target.value, applyModules: true }), onDone)}>{PLANS.map((p) => <option key={p}>{p}</option>)}</select></div>
        <div><Label>Statusi</Label>
          <select className={select} value={hotel.status} disabled={act.pending} onChange={(e) => act.run(() => setHotelStatus({ orgId: hotel.id, status: e.target.value }), onDone)}>{['demo', 'trial', 'active', 'suspended'].map((s) => <option key={s}>{s}</option>)}</select></div>
      </div>
      <div>
        <p className="mb-2 text-xs tracking-wider text-muted uppercase">Modulet</p>
        <ul className="space-y-1">
          {ALL_MODULES.map((m: ModuleKey) => (
            <li key={m}>
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-surface-2">
                <span>{MODULE_LABELS[m].sq}</span>
                <input type="checkbox" checked={on.has(m)} disabled={act.pending} onChange={(e) => act.run(() => toggleHotelModule({ orgId: hotel.id, module: m, enabled: e.target.checked }), onDone)} />
              </label>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <div className="flex items-center justify-between"><p className="text-xs tracking-wider text-muted uppercase">Pagesat (cash)</p><Button size="sm" variant="secondary" onClick={() => setPaying(true)}><Banknote /> Regjistro</Button></div>
        <p className="mt-2 text-sm">{hotel.billing.paidUntil ? `Paguar deri ${hotel.billing.paidUntil}` : 'Asnjë pagesë ende'}</p>
        <ul className="mt-2 space-y-1 text-xs text-muted">{hotel.billing.payments.slice(0, 5).map((p, i) => <li key={i}>{p.date} · {p.amount} {p.currency} · {p.months} muaj{p.note ? ` · ${p.note}` : ''}</li>)}</ul>
      </div>
      {act.message && <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{act.message}</p>}
      {paying && <PayDialog hotel={hotel} onClose={() => setPaying(false)} onDone={() => { setPaying(false); onDone(); }} />}
    </aside>
  );
}

function PayDialog({ hotel, onClose, onDone }: { hotel: AdminHotel; onClose: () => void; onDone: () => void }) {
  const act = useAction(ERR);
  const [f, setF] = useState({ amount: 400, currency: 'EUR', months: 12, note: '' });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel="×">
        <DialogHeader><DialogTitle>Pagesë · {hotel.name}</DialogTitle></DialogHeader>
        <form className="grid grid-cols-3 gap-3" onSubmit={(e) => { e.preventDefault(); act.run(() => recordHotelPayment({ orgId: hotel.id, ...f }), onDone); }}>
          <div><Label>Shuma</Label><Input type="number" min={1} value={f.amount} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} /></div>
          <div><Label>Monedha</Label><select className={select} value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })}>{['EUR', 'ALL', 'USD'].map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><Label>Muaj</Label><Input type="number" min={1} max={36} value={f.months} onChange={(e) => setF({ ...f, months: Number(e.target.value) })} /></div>
          <div className="col-span-3"><Label>Shënim</Label><Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Cash marrë nga Gerti…" /></div>
          {act.message && <p className="col-span-3 text-sm text-danger">{act.message}</p>}
          <DialogFooter className="col-span-3"><Button type="button" variant="ghost" onClick={onClose}>×</Button><Button type="submit" disabled={act.pending}>Ruaj pagesën</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const act = useAction(ERR);
  const [f, setF] = useState({ name: '', slug: '', plan: 'pro', city: '', currency: 'EUR', ownerEmail: '', ownerName: '' });
  const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel="×" className="max-w-lg">
        <DialogHeader><DialogTitle>Hotel i ri</DialogTitle></DialogHeader>
        <form className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); act.run(() => createHotel(f), onDone); }}>
          <div className="col-span-2"><Label>Emri</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value, slug: slugify(e.target.value) })} required /></div>
          <div><Label>Slug (faqja /r/…)</Label><Input value={f.slug} onChange={(e) => setF({ ...f, slug: slugify(e.target.value) })} required /></div>
          <div><Label>Qyteti</Label><Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></div>
          <div><Label>Plani</Label><select className={select} value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value })}>{PLANS.map((p) => <option key={p}>{p}</option>)}</select></div>
          <div><Label>Monedha</Label><select className={select} value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })}>{['EUR', 'ALL', 'USD'].map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><Label>Emri i pronarit</Label><Input value={f.ownerName} onChange={(e) => setF({ ...f, ownerName: e.target.value })} required /></div>
          <div><Label>Email i pronarit</Label><Input type="email" value={f.ownerEmail} onChange={(e) => setF({ ...f, ownerEmail: e.target.value })} required /></div>
          {act.message && <p className="col-span-2 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{act.message}</p>}
          <DialogFooter className="col-span-2"><Button type="button" variant="ghost" onClick={onClose}>×</Button><Button type="submit" disabled={act.pending}>Krijo dhe fto pronarin</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
