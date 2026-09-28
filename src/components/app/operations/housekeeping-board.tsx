'use client';

import { useState } from 'react';
import { Check, Clock3, Play, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import { resolveMaintenanceTicket, updateHousekeepingTask } from '@/server/actions/operations';
import type { Operations } from '@/server/queries/operations';

type Task = Operations['tasks'][number];
type Copy = {
  title: string;
  subtitle: string;
  eyebrow: string;
  open: string;
  progress: string;
  done: string;
  empty: string;
  maintenance: string;
  resolve: string;
  start: string;
  complete: string;
  cancelled: string;
  due: string;
  assigned: string;
  unassigned: string;
  type: Record<Task['type'], string>;
  priority: Record<Task['priority'], string>;
};

export function HousekeepingBoard({
  data,
  canManage,
  userId,
  copy,
}: {
  data: Operations;
  canManage: boolean;
  userId: string;
  copy: Copy;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const roomsById = new Map(data.rooms.map((r) => [r.id, r]));
  const columns: Array<{ status: 'open' | 'in_progress' | 'done'; label: string; icon: typeof Clock3 }> = [
    { status: 'open', label: copy.open, icon: Clock3 },
    { status: 'in_progress', label: copy.progress, icon: Play },
    { status: 'done', label: copy.done, icon: Check },
  ];

  async function run(action: (form: FormData) => Promise<void>, form: FormData, id: string) {
    setBusy(id);
    setError('');
    try {
      await action(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl">
      <header className="relative overflow-hidden rounded-2xl bg-ionian-950 p-8 text-limestone-50 md:p-12">
        <div className="pointer-events-none absolute -right-16 -top-36 size-96 rounded-full border-[42px] border-ionian-500/15" />
        <p className="text-xs tracking-[0.25em] text-gold-400 uppercase">{copy.eyebrow}</p>
        <h1 className="font-display relative mt-5 text-5xl md:text-7xl">{copy.title}</h1>
        <p className="relative mt-3 max-w-xl text-sm text-ionian-200">{copy.subtitle}</p>
      </header>

      {error && <p role="alert" className="mt-5 rounded-md bg-danger-soft p-4 text-sm text-danger">{error}</p>}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {columns.map(({ status, label, icon: Icon }) => {
          const tasks = data.tasks.filter((t) => t.status === status);
          return (
            <section key={status} className="min-h-72 rounded-xl border border-border bg-surface-2/60 p-3">
              <div className="flex items-center gap-2 px-2 py-3">
                <Icon className="size-4 text-muted" />
                <h2 className="text-sm font-medium">{label}</h2>
                <span className="ml-auto rounded-full bg-surface px-2 py-0.5 text-xs tabular-nums text-muted">{tasks.length}</span>
              </div>

              {tasks.length === 0 && <p className="py-12 text-center text-xs text-subtle">{copy.empty}</p>}

              <div className="space-y-2">
                {tasks.map((task) => {
                  const room = roomsById.get(task.roomId);
                  const allowed = canManage || !task.assignedTo || task.assignedTo === userId;
                  return (
                    <article key={task.id} className="rounded-lg border border-border bg-surface p-4 shadow-soft">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-serif text-3xl">{room?.number ?? '—'}</span>
                        <span className={cn(
                          'rounded-full px-2 py-1 text-[10px]',
                          task.priority === 'urgent' ? 'bg-danger-soft text-danger' :
                          task.priority === 'high' ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-muted',
                        )}>
                          {copy.priority[task.priority]}
                        </span>
                      </div>
                      <p className="mt-2 text-sm font-medium">{copy.type[task.type]}</p>
                      <p className="mt-2 text-xs text-muted">
                        {copy.due}: {task.dueDate} · {task.assigneeName ?? copy.unassigned}
                      </p>
                      {task.notes && <p className="mt-2 text-xs leading-relaxed text-muted">{task.notes}</p>}

                      {allowed && status !== 'done' && (
                        <form
                          action={(form) => run(updateHousekeepingTask, form, task.id)}
                          className="mt-4"
                        >
                          <input type="hidden" name="taskId" value={task.id} />
                          <input type="hidden" name="status" value={status === 'open' ? 'in_progress' : 'done'} />
                          <button
                            disabled={busy === task.id}
                            className="h-9 w-full rounded-md border border-border-strong text-xs font-medium transition-colors hover:bg-surface-2 disabled:opacity-50"
                          >
                            {status === 'open' ? copy.start : copy.complete}
                          </button>
                        </form>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <section className="mt-8">
        <div className="mb-4 flex items-center gap-3">
          <Wrench className="size-5 text-terracotta-500" />
          <h2 className="font-serif text-3xl">{copy.maintenance}</h2>
          <span className="text-xs text-subtle">{data.tickets.length}</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.tickets.map((ticket) => (
            <article key={ticket.id} className="rounded-xl border border-border bg-surface p-5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-muted">#{ticket.roomNumber ?? '—'}</span>
                <span className={cn('size-2 rounded-full', ticket.blocksRoom ? 'bg-danger' : 'bg-gold-400')} />
              </div>
              <h3 className="mt-3 font-serif text-2xl">{ticket.title}</h3>
              {ticket.description && <p className="mt-2 text-xs leading-relaxed text-muted">{ticket.description}</p>}
              {canManage && (
                <form action={(form) => run(resolveMaintenanceTicket, form, ticket.id)} className="mt-4">
                  <input type="hidden" name="ticketId" value={ticket.id} />
                  <button disabled={busy === ticket.id} className="h-9 w-full rounded-md border border-border-strong text-xs hover:bg-surface-2 disabled:opacity-50">{copy.resolve}</button>
                </form>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
