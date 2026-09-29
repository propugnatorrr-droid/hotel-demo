'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ExternalLink, Plus } from 'lucide-react';
import { PageHero } from '@/components/app/page-hero';
import { useAction } from '@/components/app/use-action';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input, Label, Textarea } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { addRoom, inviteStaff, saveRoomType, setRoomActive, updateAiPersona, updateHotelProfile, updateMember } from '@/server/actions/settings';
import type { SettingsData } from '@/server/queries/settings';
import { pickSettingsCopy } from './copy';

const select = 'h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm';
const ROLES = ['owner', 'manager', 'receptionist', 'housekeeping', 'pos', 'spa', 'accountant'] as const;

export function SettingsView({ data, tab, locale, isOwner }: { data: SettingsData; tab: 'hotel' | 'ai' | 'rooms' | 'team'; locale: string; isOwner: boolean }) {
  const t = pickSettingsCopy(locale);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHero eyebrow={t.eyebrow} title={t.title} subtitle={t.subtitle} actions={<a href={data.siteUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-full bg-limestone-50 px-5 text-sm font-medium text-ionian-950"><ExternalLink className="size-4" /> {t.siteLink}</a>}>
        <nav className="relative mt-8 flex flex-wrap gap-2">
          {(['hotel', 'ai', 'rooms', 'team'] as const).map((k) => <Link key={k} href={`?tab=${k}`} className={cn('inline-flex h-9 items-center rounded-full px-4 text-xs', tab === k ? 'bg-limestone-50 font-medium text-ionian-950' : 'bg-white/10 text-ionian-100 hover:bg-white/15')}>{t.tabs[k]}</Link>)}
        </nav>
      </PageHero>
      <div className="mt-6">
        {tab === 'hotel' && <HotelForm data={data} t={t} />}
        {tab === 'ai' && <AiForm data={data} t={t} />}
        {tab === 'rooms' && <RoomsPanel data={data} t={t} />}
        {tab === 'team' && <TeamPanel data={data} t={t} isOwner={isOwner} />}
      </div>
    </div>
  );
}

function Feedback({ act, saved }: { act: ReturnType<typeof useAction>; saved: boolean }) {
  return act.message ? <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{act.message}</p> : saved ? <p className="rounded-md bg-success-soft px-3 py-2 text-sm text-success">✓</p> : null;
}

function HotelForm({ data, t }: { data: SettingsData; t: ReturnType<typeof pickSettingsCopy> }) {
  const router = useRouter();
  const act = useAction(t.errors);
  const [f, setF] = useState(data.profile);
  const [saved, setSaved] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => { setSaved(false); setF((x) => ({ ...x, [k]: v })); };
  const L = t.hotel;
  return (
    <form className="grid gap-4 rounded-2xl border border-border bg-surface p-6 shadow-soft sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); act.run(() => updateHotelProfile(f), () => { setSaved(true); router.refresh(); }); }}>
      <div><Label>{L.name}</Label><Input value={f.name} onChange={(e) => set('name', e.target.value)} required /></div>
      <div><Label>{L.legalName}</Label><Input value={f.legalName} onChange={(e) => set('legalName', e.target.value)} /></div>
      <div><Label>{L.nipt}</Label><Input value={f.nipt} onChange={(e) => set('nipt', e.target.value)} /></div>
      <div><Label>{L.city}</Label><Input value={f.city} onChange={(e) => set('city', e.target.value)} /></div>
      <div className="sm:col-span-2"><Label>{L.address}</Label><Input value={f.address} onChange={(e) => set('address', e.target.value)} /></div>
      <div><Label>{L.phone}</Label><Input value={f.phone} onChange={(e) => set('phone', e.target.value)} /></div>
      <div><Label>{L.email}</Label><Input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></div>
      <div><Label>{L.website}</Label><Input value={f.website} onChange={(e) => set('website', e.target.value)} placeholder="https://" /></div>
      <div><Label>{L.cover}</Label><Input value={f.coverImageUrl} onChange={(e) => set('coverImageUrl', e.target.value)} placeholder="https://" /></div>
      <div><Label>{L.currency}</Label><select className={select} value={f.currency} onChange={(e) => set('currency', e.target.value as never)}>{['EUR', 'ALL', 'USD'].map((c) => <option key={c}>{c}</option>)}</select></div>
      <div><Label>{L.locale}</Label><select className={select} value={f.defaultLocale} onChange={(e) => set('defaultLocale', e.target.value as never)}><option value="sq">Shqip</option><option value="en">English</option></select></div>
      <div><Label>{L.checkIn}</Label><Input type="time" value={f.checkInTime} onChange={(e) => set('checkInTime', e.target.value)} /></div>
      <div><Label>{L.checkOut}</Label><Input type="time" value={f.checkOutTime} onChange={(e) => set('checkOutTime', e.target.value)} /></div>
      <div className="sm:col-span-2"><Label>{L.review}</Label><Input value={f.reviewLink} onChange={(e) => set('reviewLink', e.target.value)} placeholder="https://g.page/…" /></div>
      <div><Label>{L.fx}</Label><Input type="number" step="0.01" value={f.fxAllPerEur} onChange={(e) => set('fxAllPerEur', Number(e.target.value))} /></div>
      <div><Label>{L.ownerWhatsapp}</Label><Input value={f.ownerWhatsapp} onChange={(e) => set('ownerWhatsapp', e.target.value)} placeholder="+355…" /></div>
      <div><Label>{L.telegram}</Label><Input value={f.telegramChatId} onChange={(e) => set('telegramChatId', e.target.value)} /></div>
      <div className="flex items-end justify-end gap-3 sm:col-span-2"><Feedback act={act} saved={saved} /><Button type="submit" disabled={act.pending}>{t.save}</Button></div>
    </form>
  );
}

function AiForm({ data, t }: { data: SettingsData; t: ReturnType<typeof pickSettingsCopy> }) {
  const act = useAction(t.errors);
  const [f, setF] = useState(data.persona);
  const [saved, setSaved] = useState(false);
  return (
    <form className="ai-glow space-y-4 rounded-2xl p-6" onSubmit={(e) => { e.preventDefault(); act.run(() => updateAiPersona(f), () => setSaved(true)); }}>
      <div><Label>{t.ai.name}</Label><Input value={f.name} onChange={(e) => { setSaved(false); setF({ ...f, name: e.target.value }); }} required /></div>
      <div><Label>{t.ai.tone}</Label><Input value={f.tone} placeholder={t.ai.toneHint} onChange={(e) => { setSaved(false); setF({ ...f, tone: e.target.value }); }} required /></div>
      <div><Label>{t.ai.instructions}</Label><Textarea rows={8} value={f.instructions} placeholder={t.ai.instructionsHint} onChange={(e) => { setSaved(false); setF({ ...f, instructions: e.target.value }); }} /></div>
      <div className="flex items-center justify-end gap-3"><Feedback act={act} saved={saved} /><Button type="submit" disabled={act.pending}>{t.save}</Button></div>
    </form>
  );
}

function RoomsPanel({ data, t }: { data: SettingsData; t: ReturnType<typeof pickSettingsCopy> }) {
  const router = useRouter();
  const act = useAction(t.errors);
  const [editing, setEditing] = useState<SettingsData['types'][number] | 'new' | null>(null);
  const [num, setNum] = useState('');
  const [floor, setFloor] = useState(0);
  const [typeId, setTypeId] = useState(data.types[0]?.id ?? '');
  const R = t.rooms;
  return (
    <div className="space-y-8">
      <section>
        <div className="flex items-end justify-between"><h2 className="font-display text-3xl">{R.types}</h2><Button variant="secondary" size="sm" onClick={() => setEditing('new')}><Plus /> {R.addType}</Button></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {data.types.map((ty) => (
            <button key={ty.id} type="button" onClick={() => setEditing(ty)} className={cn('rounded-xl border border-border bg-surface p-4 text-left shadow-soft transition-all hover:-translate-y-px hover:shadow-lift', !ty.isActive && 'opacity-50')}>
              <div className="flex items-baseline justify-between"><span className="font-display text-2xl">{locale(ty, t)}</span><span className="font-serif text-xl tabular-nums">{ty.basePrice}</span></div>
              <p className="mt-1 text-xs text-muted">{ty.code} · {R.roomsCount(data.rooms.filter((r) => r.typeId === ty.id).length)} · {ty.maxOccupancy} {R.perNight === '' ? '' : ''}</p>
            </button>
          ))}
        </div>
      </section>
      <section>
        <h2 className="font-display text-3xl">{R.rooms}</h2>
        <form className="mt-4 flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); act.run(() => addRoom({ roomTypeId: typeId, number: num, floor }), () => { setNum(''); router.refresh(); }); }}>
          <div><Label>{R.number}</Label><Input className="w-28" value={num} onChange={(e) => setNum(e.target.value)} required /></div>
          <div><Label>{R.floor}</Label><Input className="w-20" type="number" value={floor} onChange={(e) => setFloor(Number(e.target.value))} /></div>
          <div><Label>{R.type}</Label><select className={cn(select, 'w-56')} value={typeId} onChange={(e) => setTypeId(e.target.value)}>{data.types.map((ty) => <option key={ty.id} value={ty.id}>{ty.code} · {ty.nameSq}</option>)}</select></div>
          <Button type="submit" disabled={act.pending || !typeId}><Plus /> {R.addRoom}</Button>
        </form>
        {act.message && <p className="mt-2 text-sm text-danger">{act.message}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          {data.rooms.map((r) => (
            <button key={r.id} type="button" title={r.isActive ? R.deactivate : R.activate} onClick={() => act.run(() => setRoomActive({ roomId: r.id, active: !r.isActive }), () => router.refresh())} className={cn('h-14 w-16 rounded-lg border text-center transition-colors', r.isActive ? 'border-border-strong bg-surface hover:bg-surface-2' : 'border-dashed border-border bg-surface-2 text-subtle line-through')}>
              <span className="block font-serif text-xl leading-none">{r.number}</span><span className="text-[10px] text-subtle">{data.types.find((x) => x.id === r.typeId)?.code}</span>
            </button>
          ))}
        </div>
      </section>
      {editing && <TypeDialog key={editing === 'new' ? 'new' : editing.id} type={editing === 'new' ? null : editing} t={t} onClose={() => setEditing(null)} onDone={() => { setEditing(null); router.refresh(); }} />}
    </div>
  );
}
const locale = (ty: { nameSq: string; nameEn: string }, _t: unknown) => ty.nameSq || ty.nameEn;

function TypeDialog({ type, t, onClose, onDone }: { type: SettingsData['types'][number] | null; t: ReturnType<typeof pickSettingsCopy>; onClose: () => void; onDone: () => void }) {
  const act = useAction(t.errors);
  const R = t.rooms;
  const [f, setF] = useState({ id: type?.id, code: type?.code ?? '', nameSq: type?.nameSq ?? '', nameEn: type?.nameEn ?? '', descSq: type?.descSq ?? '', descEn: type?.descEn ?? '', basePrice: type?.basePrice ?? 100, baseOccupancy: type?.baseOccupancy ?? 2, maxOccupancy: type?.maxOccupancy ?? 2, sizeSqm: type?.sizeSqm ?? undefined, bedType: type?.bedType ?? '', view: type?.view ?? '', amenities: type?.amenities ?? '', images: type?.images ?? '', isActive: type?.isActive ?? true });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel="×" className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>{type ? type.nameSq : R.addType}</DialogTitle></DialogHeader>
        <form className="grid grid-cols-2 gap-3" onSubmit={(e) => { e.preventDefault(); act.run(() => saveRoomType(f), onDone); }}>
          <div><Label>{R.code}</Label><Input value={f.code} onChange={(e) => set('code', e.target.value)} required maxLength={8} /></div>
          <div><Label>{R.price}</Label><Input type="number" min={0} step="0.01" value={f.basePrice} onChange={(e) => set('basePrice', Number(e.target.value))} /></div>
          <div><Label>{R.nameSq}</Label><Input value={f.nameSq} onChange={(e) => set('nameSq', e.target.value)} required /></div>
          <div><Label>{R.nameEn}</Label><Input value={f.nameEn} onChange={(e) => set('nameEn', e.target.value)} required /></div>
          <div><Label>{R.descSq}</Label><Textarea rows={2} value={f.descSq} onChange={(e) => set('descSq', e.target.value)} /></div>
          <div><Label>{R.descEn}</Label><Textarea rows={2} value={f.descEn} onChange={(e) => set('descEn', e.target.value)} /></div>
          <div><Label>{R.baseOcc}</Label><Input type="number" min={1} value={f.baseOccupancy} onChange={(e) => set('baseOccupancy', Number(e.target.value))} /></div>
          <div><Label>{R.maxOcc}</Label><Input type="number" min={1} value={f.maxOccupancy} onChange={(e) => set('maxOccupancy', Number(e.target.value))} /></div>
          <div><Label>{R.size}</Label><Input type="number" min={5} value={f.sizeSqm ?? ''} onChange={(e) => set('sizeSqm', e.target.value ? Number(e.target.value) : undefined)} /></div>
          <div><Label>{R.bed}</Label><Input value={f.bedType} onChange={(e) => set('bedType', e.target.value)} /></div>
          <div className="col-span-2"><Label>{R.amenities}</Label><Input value={f.amenities} onChange={(e) => set('amenities', e.target.value)} /></div>
          <div className="col-span-2"><Label>{R.images}</Label><Textarea rows={3} value={f.images} onChange={(e) => set('images', e.target.value)} /></div>
          <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={f.isActive} onChange={(e) => set('isActive', e.target.checked)} /> {R.active}</label>
          {act.message && <p className="col-span-2 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">{act.message}</p>}
          <DialogFooter className="col-span-2"><Button type="button" variant="ghost" onClick={onClose}>×</Button><Button type="submit" disabled={act.pending}>{t.save}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TeamPanel({ data, t, isOwner }: { data: SettingsData; t: ReturnType<typeof pickSettingsCopy>; isOwner: boolean }) {
  const router = useRouter();
  const act = useAction(t.errors);
  const [f, setF] = useState({ email: '', fullName: '', role: 'receptionist' as (typeof ROLES)[number] });
  const [note, setNote] = useState(false);
  const assignable = ROLES.filter((r) => isOwner || !['owner', 'manager'].includes(r));
  return (
    <div className="space-y-6">
      <form className="grid gap-3 rounded-2xl border border-border bg-surface p-5 shadow-soft sm:grid-cols-[1fr_1fr_11rem_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); setNote(false); act.run(() => inviteStaff(f), () => { setNote(true); setF({ ...f, email: '', fullName: '' }); router.refresh(); }); }}>
        <div><Label>{t.team.email}</Label><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></div>
        <div><Label>{t.team.fullName}</Label><Input value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} required /></div>
        <div><Label>{t.team.role}</Label><select className={select} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as never })}>{assignable.map((r) => <option key={r} value={r}>{t.roles[r]}</option>)}</select></div>
        <Button type="submit" disabled={act.pending}>{t.team.send}</Button>
        {(act.message || note) && <p className={cn('text-sm sm:col-span-4', act.message ? 'text-danger' : 'text-success')}>{act.message ?? t.team.invited}</p>}
      </form>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface shadow-soft">
        {data.members.map((m) => (
          <li key={m.id} className={cn('flex flex-wrap items-center gap-3 px-4 py-3', !m.isActive && 'opacity-50')}>
            <span className="grid size-9 place-items-center rounded-full bg-ionian-900 text-sm font-medium text-limestone-50">{(m.name ?? m.email).slice(0, 1).toUpperCase()}</span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{m.name ?? m.email}{m.isSelf && <Badge className="ml-2" tone="accent">{t.team.you}</Badge>}</span><span className="block truncate text-xs text-muted">{m.email}</span></span>
            <select disabled={m.isSelf || act.pending || (!isOwner && ['owner', 'manager'].includes(m.role))} value={m.role} onChange={(e) => act.run(() => updateMember({ membershipId: m.id, role: e.target.value }), () => router.refresh())} className="h-9 rounded-md border border-border-strong bg-surface px-2 text-sm">
              {ROLES.filter((r) => isOwner || !['owner', 'manager'].includes(r) || r === m.role).map((r) => <option key={r} value={r}>{t.roles[r]}</option>)}
            </select>
            {!m.isSelf && <Button size="sm" variant="ghost" disabled={act.pending || (!isOwner && ['owner', 'manager'].includes(m.role))} onClick={() => act.run(() => updateMember({ membershipId: m.id, isActive: !m.isActive }), () => router.refresh())}>{m.isActive ? t.team.disable : t.team.enable}</Button>}
          </li>
        ))}
      </ul>
    </div>
  );
}
