'use server';

import { and, eq, gt, inArray, lt, ne, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/db';
import {
  auditLogs,
  bookings,
  housekeepingTasks,
  maintenanceTickets,
  memberships,
  rooms,
} from '@/db/schema';
import { requireOrg } from '@/lib/auth/session';
import { todayIn } from '@/lib/dates';

const uuid = z.string().uuid();
const taskType = z.enum(['checkout_clean', 'stayover', 'inspection', 'deep_clean', 'turndown']);
const priority = z.enum(['low', 'normal', 'high', 'urgent']);
const roomStatus = z.enum(['clean', 'dirty', 'inspected', 'out_of_order']);
const taskStatus = z.enum(['open', 'in_progress', 'done', 'cancelled']);

const OPERATORS = ['owner', 'manager', 'receptionist', 'housekeeping'];
const MANAGERS = ['owner', 'manager'];

function refresh() {
  revalidatePath('/app/rooms');
  revalidatePath('/app/housekeeping');
  revalidatePath('/app');
  revalidatePath('/en/app/rooms');
  revalidatePath('/en/app/housekeeping');
  revalidatePath('/en/app');
}

function requireOperator(role: string, isAdmin: boolean) {
  if (!OPERATORS.includes(role) && !isAdmin) throw new Error('Not permitted');
}

function requireManager(role: string, isAdmin: boolean) {
  if (!MANAGERS.includes(role) && !isAdmin) throw new Error('Manager permission required');
}

async function getRoom(orgId: string, roomId: string) {
  const [room] = await db
    .select()
    .from(rooms)
    .where(and(eq(rooms.orgId, orgId), eq(rooms.id, roomId), eq(rooms.isActive, true)))
    .limit(1);

  if (!room) throw new Error('Room not found in this hotel');
  return room;
}

/** Includes future confirmed stays: don't silently put a sold room out of service. */
async function hasCurrentOrFutureBookings(orgId: string, roomId: string, today: string) {
  const [row] = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.orgId, orgId),
        eq(bookings.roomId, roomId),
        inArray(bookings.status, ['tentative', 'confirmed', 'checked_in']),
        gt(bookings.checkOut, today),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function changeRoomStatus(form: FormData) {
  const ctx = await requireOrg();
  if (!ctx.modules.has('pms')) throw new Error('Module disabled');
  requireOperator(ctx.role, ctx.profile.isSuperAdmin);

  const roomId = uuid.parse(form.get('roomId'));
  const next = roomStatus.parse(form.get('status'));
  const room = await getRoom(ctx.org.id, roomId);
  const today = todayIn(ctx.org.timezone);

  if (next === 'out_of_order') {
    requireManager(ctx.role, ctx.profile.isSuperAdmin);
    if (await hasCurrentOrFutureBookings(ctx.org.id, roomId, today)) {
      throw new Error('This room has a current or future booking. Reassign bookings first.');
    }
  }

  if (next === 'inspected' && room.status === 'out_of_order') {
    throw new Error('Resolve maintenance and mark the room dirty before inspection.');
  }

  if (next !== room.status) {
    await db.transaction(async (tx) => {
      await tx.update(rooms).set({ status: next }).where(and(eq(rooms.id, roomId), eq(rooms.orgId, ctx.org.id)));

      await tx.insert(auditLogs).values({
        orgId: ctx.org.id,
        userId: ctx.user.id,
        action: 'room.status_changed',
        entityType: 'room',
        entityId: roomId,
        meta: { from: room.status, to: next },
      });
    });
  }

  refresh();
}

export async function createHousekeepingTask(form: FormData) {
  const ctx = await requireOrg();
  if (!ctx.modules.has('pms')) throw new Error('Module disabled');
  requireOperator(ctx.role, ctx.profile.isSuperAdmin);

  const roomId = uuid.parse(form.get('roomId'));
  const type = taskType.parse(form.get('type'));
  const level = priority.parse(form.get('priority') || 'normal');
  const notes = z.string().trim().max(500).parse(form.get('notes') || '');
  const assigneeValue = form.get('assignedTo');
  const assignedTo = assigneeValue ? uuid.parse(assigneeValue) : null;

  const today = todayIn(ctx.org.timezone);
  const dueDate = z.iso.date().parse(form.get('dueDate') || today);
  if (dueDate < today || dueDate > new Date(Date.now() + 31 * 86_400_000).toISOString().slice(0, 10)) {
    throw new Error('Due date must be within the next 31 days');
  }

  await getRoom(ctx.org.id, roomId);

  if (assignedTo) {
    const [member] = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(
          eq(memberships.orgId, ctx.org.id),
          eq(memberships.userId, assignedTo),
          eq(memberships.isActive, true),
          inArray(memberships.role, ['owner', 'manager', 'housekeeping']),
        ),
      )
      .limit(1);
    if (!member) throw new Error('Assignee is not on this hotel’s housekeeping team');
  }

  await db.transaction(async (tx) => {
    const [task] = await tx
      .insert(housekeepingTasks)
      .values({
        orgId: ctx.org.id,
        roomId,
        type,
        priority: level,
        notes: notes || null,
        assignedTo,
        dueDate,
      })
      .returning({ id: housekeepingTasks.id });

    await tx.insert(auditLogs).values({
      orgId: ctx.org.id,
      userId: ctx.user.id,
      action: 'housekeeping.created',
      entityType: 'housekeeping_task',
      entityId: task!.id,
      meta: { roomId, type, dueDate },
    });
  });

  refresh();
}

export async function updateHousekeepingTask(form: FormData) {
  const ctx = await requireOrg();
  if (!ctx.modules.has('pms')) throw new Error('Module disabled');
  requireOperator(ctx.role, ctx.profile.isSuperAdmin);

  const id = uuid.parse(form.get('taskId'));
  const next = taskStatus.parse(form.get('status'));

  const [task] = await db
    .select()
    .from(housekeepingTasks)
    .where(and(eq(housekeepingTasks.id, id), eq(housekeepingTasks.orgId, ctx.org.id)))
    .limit(1);

  if (!task) throw new Error('Task not found');
  if (task.status === 'done' || task.status === 'cancelled') throw new Error('This task is closed');
  if (next === 'open') throw new Error('Cannot move a task backwards');

  // Housekeepers can work their own tasks; managers/reception can coordinate.
  if (ctx.role === 'housekeeping' && task.assignedTo && task.assignedTo !== ctx.user.id && !ctx.profile.isSuperAdmin) {
    throw new Error('This task is assigned to another person');
  }

  await db.transaction(async (tx) => {
    await tx
      .update(housekeepingTasks)
      .set({
        status: next,
        startedAt: next === 'in_progress' ? new Date() : task.startedAt,
        completedAt: next === 'done' ? new Date() : null,
      })
      .where(and(eq(housekeepingTasks.id, id), eq(housekeepingTasks.orgId, ctx.org.id)));

    if (next === 'done' && task.type === 'inspection') {
      const [room] = await tx
        .select({ status: rooms.status })
        .from(rooms)
        .where(and(eq(rooms.id, task.roomId), eq(rooms.orgId, ctx.org.id)))
        .limit(1);
      if (room?.status === 'clean') {
        await tx
          .update(rooms)
          .set({ status: 'inspected' })
          .where(and(eq(rooms.id, task.roomId), eq(rooms.orgId, ctx.org.id)));
      }
    }

    if (next === 'done' && task.type !== 'inspection') {
      const [room] = await tx
        .select({ status: rooms.status })
        .from(rooms)
        .where(and(eq(rooms.id, task.roomId), eq(rooms.orgId, ctx.org.id)))
        .limit(1);
      if (room?.status === 'dirty') {
        await tx
          .update(rooms)
          .set({ status: 'clean' })
          .where(and(eq(rooms.id, task.roomId), eq(rooms.orgId, ctx.org.id)));
      }
    }

    await tx.insert(auditLogs).values({
      orgId: ctx.org.id,
      userId: ctx.user.id,
      action: 'housekeeping.status_changed',
      entityType: 'housekeeping_task',
      entityId: id,
      meta: { from: task.status, to: next },
    });
  });

  refresh();
}

export async function createMaintenanceTicket(form: FormData) {
  const ctx = await requireOrg();
  if (!ctx.modules.has('pms')) throw new Error('Module disabled');
  requireOperator(ctx.role, ctx.profile.isSuperAdmin);

  const roomId = uuid.parse(form.get('roomId'));
  const title = z.string().trim().min(4).max(120).parse(form.get('title'));
  const description = z.string().trim().max(1000).parse(form.get('description') || '');
  const level = priority.parse(form.get('priority') || 'normal');
  const block = form.get('blocksRoom') === 'on';
  const room = await getRoom(ctx.org.id, roomId);

  if (block) {
    requireManager(ctx.role, ctx.profile.isSuperAdmin);
    if (await hasCurrentOrFutureBookings(ctx.org.id, roomId, todayIn(ctx.org.timezone))) {
      throw new Error('Room has a current or future booking. Reassign it before blocking the room.');
    }
  }

  await db.transaction(async (tx) => {
    const [ticket] = await tx
      .insert(maintenanceTickets)
      .values({
        orgId: ctx.org.id,
        roomId,
        title,
        description: description || null,
        priority: level,
        blocksRoom: block,
        reportedBy: ctx.user.id,
      })
      .returning({ id: maintenanceTickets.id });

    if (block) {
      await tx.update(rooms).set({ status: 'out_of_order' }).where(and(eq(rooms.id, roomId), eq(rooms.orgId, ctx.org.id)));
    }

    await tx.insert(auditLogs).values({
      orgId: ctx.org.id,
      userId: ctx.user.id,
      action: 'maintenance.created',
      entityType: 'maintenance_ticket',
      entityId: ticket!.id,
      meta: { room: room.number, blocksRoom: block },
    });
  });

  refresh();
}

export async function resolveMaintenanceTicket(form: FormData) {
  const ctx = await requireOrg();
  if (!ctx.modules.has('pms')) throw new Error('Module disabled');
  requireManager(ctx.role, ctx.profile.isSuperAdmin);

  const id = uuid.parse(form.get('ticketId'));
  const [ticket] = await db
    .select()
    .from(maintenanceTickets)
    .where(and(eq(maintenanceTickets.orgId, ctx.org.id), eq(maintenanceTickets.id, id)))
    .limit(1);

  if (!ticket || ticket.status === 'done' || ticket.status === 'cancelled') throw new Error('Ticket is closed');

  await db.transaction(async (tx) => {
    await tx
      .update(maintenanceTickets)
      .set({ status: 'done', resolvedAt: new Date() })
      .where(and(eq(maintenanceTickets.orgId, ctx.org.id), eq(maintenanceTickets.id, id)));

    if (ticket.blocksRoom && ticket.roomId) {
      const [other] = await tx
        .select({ id: maintenanceTickets.id })
        .from(maintenanceTickets)
        .where(
          and(
            eq(maintenanceTickets.orgId, ctx.org.id),
            eq(maintenanceTickets.roomId, ticket.roomId),
            eq(maintenanceTickets.blocksRoom, true),
            ne(maintenanceTickets.id, id),
            inArray(maintenanceTickets.status, ['open', 'in_progress']),
          ),
        )
        .limit(1);

      if (!other) {
        await tx
          .update(rooms)
          .set({ status: 'dirty' })
          .where(
            and(
              eq(rooms.orgId, ctx.org.id),
              eq(rooms.id, ticket.roomId),
              eq(rooms.status, 'out_of_order'),
            ),
          );
      }
    }

    await tx.insert(auditLogs).values({
      orgId: ctx.org.id,
      userId: ctx.user.id,
      action: 'maintenance.resolved',
      entityType: 'maintenance_ticket',
      entityId: id,
      meta: { roomId: ticket.roomId },
    });
  });

  refresh();
}
