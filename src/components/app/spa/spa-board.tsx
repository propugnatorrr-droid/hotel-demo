'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { BedDouble, ChevronLeft, ChevronRight, Flower2, Plus } from 'lucide-react';
import { PageHero } from '@/components/app/page-hero';
import { useAction } from '@/components/app/use-action';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Label } from '@/components/ui/input';
import { SPA_CLOSE, SPA_OPEN } from '@/config/spa';
import { addDays, formatDay } from '@/lib/dates';
import { formatCurrency, type Currency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { bookAppointment, chargeAppointmentToRoom, saveSpaService, setAppointmentStatus } from '@/server/actions/spa';
import type { SpaData } from '@/server/queries/spa';
import { pickSpaCopy } from './copy';

const H = 64; // px per hour
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const OPEN = toMin(SPA_OPEN);
const CLOSE = toMin(SPA_CLOSE);
const select = 'h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm';

const TONE: Record<string, string> = {
  booked: 'bg-ionian-500 text-white',
  confirmed: 'bg-ionian-700 text-white',
  completed: 'bg-olive-500 text-white',
  cancelled: 'bg-surface-3 text-muted line-through opacity-60',
  no_show: 'bg-terracotta-500 text-white opacity-80',
};

export function SpaBoard({ data, locale, currency, manager, today }: { data: SpaData; locale: string; currency: Currency; manager: boolean; today: string }) {
  const t = pickSpaCopy(locale);
  const router = useRouter();
  const money = (n: number) => formatCurrency(n, currency, locale, 0);
  const [slot, setSlot] = useState<{ therapistId: string; time: string } | null>(null);
  const [open, setOpen] = useState<SpaData['appointments'][number] | null>(null);
  const [editing, setEditing] = useState<SpaData['services'][number] | 'new' | null>(null);
  const hours = Array.from({ length: (CLOSE - OPEN) / 60 }, (_, i) => OPEN / 60 + i);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHero
        eyebrow={t.eyebrow}
        title={t.title}
        subtitle={t.subtitle}
        actions={
          <>
            <Link href={`?date=${addDays(data.date, -1)}`} className="grid size-10 place-items-center rounded-full border border-white/15 hover:bg-white/10"><ChevronLeft className="size-4" /></Link>
            <span className="min-w-40 text-center font-serif text-2xl">{formatDay(data.date, locale, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            <Link href={`?date=${addDays(data.date, 1)}`} className="grid size-10 place-items-center rounded-full border border-white/15 hover:bg-white/10"><ChevronRight className="size-4" /></Link>
            {data.date !== today && <Link href="?" className="inline-flex h-10 items-center rounded-full bg-limestone-50 px-4 text-sm font-medium text-ionian-950">{t.today}</Link>}
          </>
        }
      />

      <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-surface shadow-soft">
        <div className="grid min-w-[40rem]" style={{ gridTemplateColumns: `4rem repeat(${Math.max(1, data.therapists.length)}, minmax(9rem, 1fr))` }}>
          <div className="border-b border-border" />
          {data.therapists.map((th) => (
            <div key={th.id} className="border-b border-l border-border px-3 py-3">
              <p className="text-sm font-medium">{th.name}</p>
              <p className="truncate text-xs text-muted">{th.specialties}</p>
            </div>
          ))}
          <div className="relative" style={{ height: hours.length * H }}>
            {hours.map((h, i) => <span key={h} className="absolute right-2 -translate-y-2 text-[11px] text-subtle tabular-nums" style={{ top: i * H }}>{String(h).padStart(2, '0')}:00</span>)}
          </div>
          {data.therapists.map((th) => (
            <div
              key={th.id}
              className="relative border-l border-border"
              style={{ height: hours.length * H, backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 ${H - 1}px, var(--border) ${H - 1}px ${H}px)` }}
              onClick={(e) => {
                if (e.target !== e.currentTarget) return;
                const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
                const mins = OPEN + Math.floor(((y / H) * 60) / 15) * 15;
                setSlot({ therapistId: th.id, time: `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}` });
              }}
            >
              {data.appointments.filter((a) => a.therapistId === th.id).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setOpen(a)}
                  className={cn('absolute inset-x-1 overflow-hidden rounded-lg px-2.5 py-1.5 text-left text-xs shadow-soft transition-transform hover:-translate-y-px hover:shadow-lift', TONE[a.status])}
                  style={{ top: ((toMin(a.start) - OPEN) / 60) * H + 1, height: Math.max(28, ((toMin(a.end) - toMin(a.start)) / 60) * H - 2) }}
                >
                  <span className="block truncate font-medium">{a.guestName}</span>
                  <span className="block truncate opacity-80">{a.start} · {a.serviceName}</span>
                  {a.charged && <BedDouble className="absolute right-1.5 bottom-1.5 size-3.5 opacity-80" />}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      <section className="mt-10">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-3xl">{t.services}</h2>
          {manager && <Button variant="secondary" size="sm" onClick={() => setEditing('new')}><Plus /> {t.addService}</Button>}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {data.services.map((s) => (
            <button key={s.id} type="button" disabled={!manager} onClick={() => setEditing(s)} className={cn('flex items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left', manager && 'hover:-translate-y-px hover:shadow-soft', !s.isActive && 'opacity-50')}>
              <span className="grid size-10 place-items-center rounded-lg bg-accent-soft text-accent"><Flower2 className="size-5" strokeWidth={1.5} /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{s.name}</span><span className="text-xs text-muted">{s.durationMin} {t.min}</span></span>
              <span className="font-serif text-xl tabular-nums">{money(s.price)}</span>
            </button>
          ))}
        </div>
      </section>

      {slot && <BookDialog data={data} slot={slot} t={t} onClose={() => setSlot(null)} onDone={() => { setSlot(null); router.refresh(); }} />}
      {open && <DetailDialog appt={open} t={t} money={money} onClose={() => setOpen(null)} onDone={() => { setOpen(null); router.refresh(); }} />}
      {editing && <ServiceDialog svc={editing === 'new' ? null : editing} t={t} onClose={() => setEditing(null)} onDone={() => { setEditing(null); router.refresh(); }} />}
    </div>
  );
}

function BookDialog({ data, slot, t, onClose, onDone }: { data: SpaData; slot: { therapistId: string; time: string }; t: ReturnType<typeof pickSpaCopy>; onClose: () => void; onDone: () => void }) {
  const act = useAction(t.errors);
  const [serviceId, setServiceId] = useState(data.services.find((s) => s.isActive)?.id ?? '');
  const [therapistId, setTherapistId] = useState(slot.therapistId);
  const [time, setTime] = useState(slot.time);
  const [bookingId, setBookingId] = useState('');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel="×">
        <DialogHeader><DialogTitle>{t.booking}</DialogTitle></DialogHeader>
        <form className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); act.run(() => bookAppointment({ serviceId, therapistId, date: data.date, time, bookingId: bookingId || undefined, guestName: bookingId ? undefined : name, notes: notes || undefined }), onDone); }}>
          <div className="col-span-2"><Label>{t.service}</Label>
            <select className={select} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>{data.services.filter((s) => s.isActive).map((s) => <option key={s.id} value={s.id}>{s.name} · {s.durationMin} {t.min}</option>)}</select></div>
          <div><Label>{t.therapist}</Label>
            <select className={select} value={therapistId} onChange={(e) => setTherapistId(e.target.value)}>{data.therapists.map((th) => <option key={th.id} value={th.id}>{th.name}</option>)}</select></div>
          <div><Label>{t.time}</Label><Input type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} required /></div>
          <div className="col-span-2"><Label>{t.inHouse}</Label>
            <select className={select} value={bookingId} onChange={(e) => setBookingId(e.target.value)}><option value="">{t.walkIn}</option>{data.inHouse.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</select></div>
          {!bookingId && <div className="col-span-2"><Label>{t.guestName}</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>}
          <div className="col-span-2"><Label>{t.notes}</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          {act.message && <p className="col-span-2 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{act.message}</p>}
          <DialogFooter className="col-span-2"><Button type="button" variant="ghost" onClick={onClose}>{t.cancel}</Button><Button type="submit" disabled={act.pending || !serviceId}>{t.book}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DetailDialog({ appt, t, money, onClose, onDone }: { appt: SpaData['appointments'][number]; t: ReturnType<typeof pickSpaCopy>; money: (n: number) => string; onClose: () => void; onDone: () => void }) {
  const act = useAction(t.errors);
  const statuses = (['confirmed', 'completed', 'cancelled', 'no_show'] as const).filter((s) => s !== appt.status);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel="×">
        <DialogHeader>
          <DialogTitle>{appt.guestName}</DialogTitle>
          <p className="text-sm text-muted">{appt.serviceName} · {appt.start}–{appt.end} · {money(appt.price)}</p>
        </DialogHeader>
        <p className="mb-4 inline-flex rounded-full bg-surface-2 px-3 py-1 text-xs">{t.status[appt.status]}{appt.charged ? ` · ${t.charged}` : ''}</p>
        {appt.notes && <p className="mb-4 text-sm text-muted">{appt.notes}</p>}
        {act.message && <p className="mb-3 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{act.message}</p>}
        <div className="flex flex-wrap gap-2">
          {statuses.map((s) => <Button key={s} size="sm" variant="secondary" disabled={act.pending} onClick={() => act.run(() => setAppointmentStatus({ id: appt.id, status: s }), onDone)}>{t.actions[s]}</Button>)}
          {appt.bookingId && !appt.charged && <Button size="sm" disabled={act.pending} onClick={() => act.run(() => chargeAppointmentToRoom({ id: appt.id }), onDone)}><BedDouble /> {t.actions.charge}</Button>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ServiceDialog({ svc, t, onClose, onDone }: { svc: SpaData['services'][number] | null; t: ReturnType<typeof pickSpaCopy>; onClose: () => void; onDone: () => void }) {
  const act = useAction(t.errors);
  const [f, setF] = useState({ nameSq: svc?.nameSq ?? '', nameEn: svc?.nameEn ?? '', durationMin: svc?.durationMin ?? 60, price: svc?.price ?? 50, isActive: svc?.isActive ?? true });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel="×">
        <DialogHeader><DialogTitle>{svc ? svc.name : t.addService}</DialogTitle></DialogHeader>
        <form className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); act.run(() => saveSpaService({ id: svc?.id, ...f }), onDone); }}>
          <div className="col-span-2"><Label>{t.nameSq}</Label><Input value={f.nameSq} onChange={(e) => setF({ ...f, nameSq: e.target.value })} required /></div>
          <div className="col-span-2"><Label>{t.nameEn}</Label><Input value={f.nameEn} onChange={(e) => setF({ ...f, nameEn: e.target.value })} required /></div>
          <div><Label>{t.duration}</Label><Input type="number" min={10} value={f.durationMin} onChange={(e) => setF({ ...f, durationMin: Number(e.target.value) })} /></div>
          <div><Label>{t.price}</Label><Input type="number" min={0} step="0.01" value={f.price} onChange={(e) => setF({ ...f, price: Number(e.target.value) })} /></div>
          <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={f.isActive} onChange={(e) => setF({ ...f, isActive: e.target.checked })} /> {t.active}</label>
          {act.message && <p className="col-span-2 text-sm text-danger">{act.message}</p>}
          <DialogFooter className="col-span-2"><Button type="button" variant="ghost" onClick={onClose}>{t.cancel}</Button><Button type="submit" disabled={act.pending}>{t.save}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
