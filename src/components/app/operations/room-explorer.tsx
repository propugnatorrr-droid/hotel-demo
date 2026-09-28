'use client';

import { useMemo, useState } from 'react';
import { BedDouble, CircleAlert, Search, Waves, X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { changeRoomStatus, createHousekeepingTask, createMaintenanceTicket } from '@/server/actions/operations';
import type { Operations } from '@/server/queries/operations';
import { localized, cn } from '@/lib/utils';

type Room = Operations['rooms'][number];

const TONE: Record<Room['status'], string> = {
  inspected: 'border-ionian-400/60 bg-ionian-100/80 text-ionian-900 dark:bg-ionian-900/70 dark:text-ionian-100',
  clean: 'border-olive-400/60 bg-olive-100/75 text-olive-700 dark:bg-olive-700/25 dark:text-olive-100',
  dirty: 'border-terracotta-400/60 bg-terracotta-100/75 text-terracotta-700 dark:bg-terracotta-700/25 dark:text-terracotta-100',
  out_of_order: 'border-border-strong bg-surface-2 text-muted',
};

type Copy = {
  title: string;
  eyebrow: string;
  subtitle: string;
  search: string;
  all: string;
  sea: string;
  room: string;
  occupied: string;
  vacant: string;
  due: string;
  tasks: string;
  floor: string;
  noResults: string;
  close: string;
  status: Record<Room['status'], string>;
  setStatus: string;
  createTask: string;
  maintenance: string;
  titleInput: string;
  description: string;
  report: string;
  block: string;
  notes: string;
  save: string;
  taskType: Record<'checkout_clean' | 'stayover' | 'inspection' | 'deep_clean' | 'turndown', string>;
};

export function RoomExplorer({
  data,
  locale,
  manager,
  copy,
}: {
  data: Operations;
  locale: string;
  manager: boolean;
  copy: Copy;
}) {
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const rooms = useMemo(
    () =>
      data.rooms.filter((r) => {
        const q = search.toLocaleLowerCase();
        return (
          (filter === 'all' || r.status === filter) &&
          (!q ||
            r.number.toLocaleLowerCase().includes(q) ||
            localized(r.roomType, locale).toLocaleLowerCase().includes(q))
        );
      }),
    [data.rooms, filter, search, locale],
  );

  const floors = [...new Set(rooms.map((r) => r.floor))].sort((a, b) => a - b);
  const active = data.rooms.find((r) => r.id === selected);

  async function submit(action: (form: FormData) => Promise<void>, form: FormData) {
    setPending(true);
    setError('');
    try {
      await action(form);
      setSelected(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <section className="relative overflow-hidden rounded-2xl bg-ionian-950 px-6 py-10 text-limestone-50 md:px-10 md:py-14">
        <div className="pointer-events-none absolute -top-36 -right-24 size-96 rounded-full bg-ionian-500/25 blur-[90px]" />
        <div className="pointer-events-none absolute -bottom-56 left-1/4 size-[36rem] rounded-full bg-olive-400/10 blur-[100px]" />
        <div className="relative">
          <p className="flex items-center gap-2 text-xs tracking-[0.3em] text-gold-400 uppercase">
            <Waves className="size-4" /> {copy.eyebrow}
          </p>
          <h1 className="font-display mt-5 text-5xl tracking-tight md:text-7xl">{copy.title}</h1>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-ionian-200">{copy.subtitle}</p>
          <div className="mt-8 grid max-w-xl grid-cols-4 divide-x divide-white/15 border-t border-white/20 pt-5">
            {(['inspected', 'clean', 'dirty', 'out_of_order'] as const).map((status) => (
              <div key={status} className="px-3 first:pl-0">
                <p className="font-serif text-3xl md:text-4xl">
                  {data.rooms.filter((r) => r.status === status).length}
                </p>
                <p className="mt-1 text-[10px] leading-tight text-ionian-200">{copy.status[status]}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-border bg-surface p-1">
          {(['all', 'inspected', 'clean', 'dirty', 'out_of_order'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                'rounded-full px-3 py-2 text-xs whitespace-nowrap transition-colors',
                filter === key ? 'bg-primary text-primary-foreground' : 'text-muted hover:bg-surface-2',
              )}
            >
              {key === 'all' ? copy.all : copy.status[key]}
            </button>
          ))}
        </div>
        <label className="flex h-10 items-center gap-2 rounded-full border border-border bg-surface px-4">
          <Search className="size-4 text-subtle" />
          <input
            className="w-32 bg-transparent text-sm outline-none sm:w-48"
            placeholder={copy.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>

      {rooms.length === 0 && <p className="mt-16 text-center text-sm text-muted">{copy.noResults}</p>}

      {floors.map((floor) => {
        const floorRooms = rooms.filter((r) => r.floor === floor);
        return (
          <section key={floor} className="mt-9">
            <div className="mb-4 flex items-center gap-4">
              <h2 className="font-serif text-3xl">{copy.floor} {floor.toString().padStart(2, '0')}</h2>
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-subtle">{floorRooms.length} {copy.room.toLowerCase()}</span>
            </div>

            {/* Rooms come from DB. No fixed number of rooms or floors. */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
              {floorRooms.map((r, i) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => { setSelected(r.id); setError(''); }}
                  className={cn(
                    'group relative min-h-44 overflow-hidden rounded-xl border p-5 text-left shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift focus-visible:outline-2 focus-visible:outline-ring',
                    TONE[r.status],
                  )}
                >
                  <div className="absolute -right-10 -bottom-20 size-44 rounded-full border border-current opacity-10 transition-transform duration-500 group-hover:scale-125" />
                  <div className="absolute -right-5 -bottom-14 size-32 rounded-full border border-current opacity-10" />
                  <div className="relative flex items-start justify-between">
                    <span className="font-serif text-5xl tabular-nums">{r.number}</span>
                    <span className="size-2.5 rounded-full bg-current opacity-75 shadow-[0_0_16px_currentColor]" />
                  </div>
                  <p className="relative mt-3 truncate text-xs opacity-80">{localized(r.roomType, locale)}</p>
                  <div className="relative mt-3 flex items-center justify-between gap-2 text-[11px]">
                    <span>{r.occupant ? copy.occupied : copy.vacant}</span>
                    {r.openTasks > 0 && <span>{r.openTasks} {copy.tasks}</span>}
                  </div>
                </button>
              ))}
            </div>
          </section>
        );
      })}

      <Sheet open={Boolean(active)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent closeLabel={copy.close} className="overflow-y-auto">
          <SheetHeader>
            <p className="text-xs tracking-[0.2em] text-accent uppercase">{copy.floor} {active?.floor}</p>
            <SheetTitle>{copy.room} {active?.number}</SheetTitle>
            <p className="text-sm text-muted">{active && localized(active.roomType, locale)}</p>
          </SheetHeader>

          {active && (
            <div className="space-y-7 p-6">
              <div className={cn('rounded-lg border p-4', TONE[active.status])}>
                <p className="text-xs">{copy.status[active.status]}</p>
                <p className="mt-2 text-sm">
                  {active.occupant
                    ? `${active.occupant.guestFirst} ${active.occupant.guestLast} · ${copy.due} ${active.occupant.checkOut}`
                    : copy.vacant}
                </p>
              </div>

              {error && (
                <p role="alert" className="rounded-md bg-danger-soft p-3 text-sm text-danger">
                  <CircleAlert className="mr-2 inline size-4" />{error}
                </p>
              )}

              <form action={(form) => submit(changeRoomStatus, form)} className="space-y-3">
                <input type="hidden" name="roomId" value={active.id} />
                <label className="block text-sm font-medium">{copy.setStatus}</label>
                <div className="flex gap-2">
                  <select name="status" defaultValue={active.status} className="h-10 min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-sm">
                    {(['inspected', 'clean', 'dirty', 'out_of_order'] as const).filter((s) => s !== 'out_of_order' || manager).map((s) => (
                      <option key={s} value={s}>{copy.status[s]}</option>
                    ))}
                  </select>
                  <button disabled={pending} className="rounded-md bg-primary px-4 text-sm text-primary-foreground disabled:opacity-50">{copy.save}</button>
                </div>
              </form>

              <div className="h-px bg-border" />

              <form action={(form) => submit(createHousekeepingTask, form)} className="space-y-3">
                <input type="hidden" name="roomId" value={active.id} />
                <h3 className="font-serif text-2xl">{copy.createTask}</h3>
                <select name="type" className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm">
                  {Object.entries(copy.taskType).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input name="dueDate" type="date" defaultValue={data.today} min={data.today} required className="h-10 min-w-0 rounded-md border border-border bg-surface px-3 text-sm" />
                  <select name="priority" defaultValue="normal" className="h-10 min-w-0 rounded-md border border-border bg-surface px-3 text-sm">
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <input name="notes" maxLength={500} placeholder={copy.notes} className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm" />
                <button disabled={pending} className="h-10 w-full rounded-md border border-border-strong text-sm transition-colors hover:bg-surface-2 disabled:opacity-50">
                  {copy.createTask}
                </button>
              </form>

              <div className="h-px bg-border" />

              <form action={(form) => submit(createMaintenanceTicket, form)} className="space-y-3">
                <input type="hidden" name="roomId" value={active.id} />
                <h3 className="font-serif text-2xl">{copy.maintenance}</h3>
                <input name="title" required minLength={4} maxLength={120} placeholder={copy.titleInput} className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm" />
                <textarea name="description" maxLength={1000} placeholder={copy.description} className="min-h-20 w-full rounded-md border border-border bg-surface p-3 text-sm" />
                <select name="priority" className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm">
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
                {manager && (
                  <label className="flex items-center gap-2 text-xs text-muted">
                    <input type="checkbox" name="blocksRoom" />
                    {copy.block}
                  </label>
                )}
                <button disabled={pending} className="h-10 w-full rounded-md bg-primary text-sm text-primary-foreground disabled:opacity-50">{copy.report}</button>
              </form>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
