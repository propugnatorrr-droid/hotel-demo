import 'server-only';

import { and, asc, eq, gte, inArray, lte, ne, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  bookings,
  guests,
  housekeepingTasks,
  maintenanceTickets,
  profiles,
  rooms,
  roomTypes,
} from '@/db/schema';
import { todayIn } from '@/lib/dates';
import type { OrgContext } from '@/lib/auth/session';

export async function getOperations(ctx: OrgContext) {
  const orgId = ctx.org.id;
  const today = todayIn(ctx.org.timezone);

  const [roomRows, occupied, taskRows, ticketRows, staffRows] = await Promise.all([
    db
      .select({
        id: rooms.id,
        number: rooms.number,
        floor: rooms.floor,
        building: rooms.building,
        status: rooms.status,
        active: rooms.isActive,
        layout: rooms.layout,
        notes: rooms.notes,
        roomType: roomTypes.name,
        typeCode: roomTypes.code,
      })
      .from(rooms)
      .innerJoin(roomTypes, and(eq(roomTypes.id, rooms.roomTypeId), eq(roomTypes.orgId, orgId)))
      .where(eq(rooms.orgId, orgId))
      .orderBy(asc(rooms.floor), asc(rooms.number)),

    db
      .select({
        roomId: bookings.roomId,
        code: bookings.code,
        guestFirst: guests.firstName,
        guestLast: guests.lastName,
        checkOut: bookings.checkOut,
      })
      .from(bookings)
      .innerJoin(guests, and(eq(guests.id, bookings.guestId), eq(guests.orgId, orgId)))
      .where(
        and(
          eq(bookings.orgId, orgId),
          inArray(bookings.status, ['confirmed', 'checked_in']),
          lte(bookings.checkIn, today),
          gte(bookings.checkOut, today),
          sql`${bookings.checkOut} > ${today}`,
        ),
      ),

    db
      .select({
        id: housekeepingTasks.id,
        roomId: housekeepingTasks.roomId,
        type: housekeepingTasks.type,
        status: housekeepingTasks.status,
        priority: housekeepingTasks.priority,
        dueDate: housekeepingTasks.dueDate,
        notes: housekeepingTasks.notes,
        assignedTo: housekeepingTasks.assignedTo,
        assigneeName: profiles.fullName,
      })
      .from(housekeepingTasks)
      .innerJoin(rooms, and(eq(rooms.id, housekeepingTasks.roomId), eq(rooms.orgId, orgId)))
      .leftJoin(profiles, eq(profiles.id, housekeepingTasks.assignedTo))
      .where(
        and(
          eq(housekeepingTasks.orgId, orgId),
          or(
            inArray(housekeepingTasks.status, ['open', 'in_progress']),
            eq(housekeepingTasks.dueDate, today),
          ),
        ),
      )
      .orderBy(asc(housekeepingTasks.dueDate), asc(rooms.number))
      .limit(200),

    db
      .select({
        id: maintenanceTickets.id,
        roomId: maintenanceTickets.roomId,
        roomNumber: rooms.number,
        title: maintenanceTickets.title,
        description: maintenanceTickets.description,
        priority: maintenanceTickets.priority,
        status: maintenanceTickets.status,
        blocksRoom: maintenanceTickets.blocksRoom,
        createdAt: maintenanceTickets.createdAt,
      })
      .from(maintenanceTickets)
      .leftJoin(rooms, and(eq(rooms.id, maintenanceTickets.roomId), eq(rooms.orgId, orgId)))
      .where(
        and(
          eq(maintenanceTickets.orgId, orgId),
          ne(maintenanceTickets.status, 'done'),
          ne(maintenanceTickets.status, 'cancelled'),
        ),
      )
      .orderBy(asc(maintenanceTickets.createdAt))
      .limit(100),

    db
      .select({ id: profiles.id, name: profiles.fullName })
      .from(profiles)
      .innerJoin(
        sql`memberships m`,
        sql`m.user_id = ${profiles.id} AND m.org_id = ${orgId} AND m.is_active = true AND m.role IN ('housekeeping','manager','owner')`,
      )
      .orderBy(asc(profiles.fullName)),
  ]);

  const guestByRoom = new Map(occupied.map((row) => [row.roomId, row]));
  const tasksByRoom = new Map<string, number>();

  for (const task of taskRows) {
    if (task.status === 'open' || task.status === 'in_progress') {
      tasksByRoom.set(task.roomId, (tasksByRoom.get(task.roomId) ?? 0) + 1);
    }
  }

  const roomsWithContext = roomRows.map((room) => ({
    ...room,
    occupant: guestByRoom.get(room.id) ?? null,
    openTasks: tasksByRoom.get(room.id) ?? 0,
  }));

  return {
    today,
    rooms: roomsWithContext,
    tasks: taskRows,
    tickets: ticketRows,
    staff: staffRows,
  };
}

export type Operations = Awaited<ReturnType<typeof getOperations>>;
