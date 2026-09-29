import 'server-only';

import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { bookings, guests, roomTypes } from '@/db/schema';
import type { OrgContext } from '@/lib/auth/session';
import { escapeLike } from './bookings';

const staysSql = sql<number>`(select count(*) from bookings b where b.org_id = ${guests.orgId} and b.guest_id = ${guests.id} and b.status in ('checked_in','checked_out'))`.mapWith(Number);
const valueSql = sql<number>`coalesce((select sum(b.total_amount) from bookings b where b.org_id = ${guests.orgId} and b.guest_id = ${guests.id} and b.status in ('checked_in','checked_out')), 0)`.mapWith(Number);
const lastSql = sql<string | null>`(select max(b.check_in)::text from bookings b where b.org_id = ${guests.orgId} and b.guest_id = ${guests.id} and b.status not in ('cancelled','no_show'))`;

export async function listGuests(ctx: OrgContext, q: string) {
  const term = q.trim().slice(0, 80);
  const like = `%${escapeLike(term)}%`;
  return db
    .select({
      id: guests.id,
      firstName: guests.firstName,
      lastName: guests.lastName,
      email: guests.email,
      phone: guests.phone,
      nationality: guests.nationality,
      isVip: guests.isVip,
      tags: guests.tags,
      stays: staysSql,
      value: valueSql,
      lastStay: lastSql,
    })
    .from(guests)
    .where(
      and(
        eq(guests.orgId, ctx.org.id),
        term
          ? or(
              ilike(guests.email, like),
              ilike(guests.phone, like),
              ilike(sql`${guests.firstName} || ' ' || ${guests.lastName}`, like),
            )
          : undefined,
      ),
    )
    .orderBy(desc(guests.isVip), desc(valueSql), guests.lastName)
    .limit(120);
}

export async function getGuestDetail(ctx: OrgContext, id: string | undefined) {
  if (!id || !z.uuid().safeParse(id).success) return null;
  const [g] = await db
    .select({
      id: guests.id,
      firstName: guests.firstName,
      lastName: guests.lastName,
      email: guests.email,
      phone: guests.phone,
      nationality: guests.nationality,
      isVip: guests.isVip,
      marketingConsent: guests.marketingConsent,
      tags: guests.tags,
      notes: guests.notes,
      stays: staysSql,
      value: valueSql,
    })
    .from(guests)
    .where(and(eq(guests.orgId, ctx.org.id), eq(guests.id, id)))
    .limit(1);
  if (!g) return null;

  const history = await db
    .select({
      id: bookings.id,
      code: bookings.code,
      status: bookings.status,
      checkIn: bookings.checkIn,
      checkOut: bookings.checkOut,
      total: bookings.totalAmount,
      typeName: roomTypes.name,
    })
    .from(bookings)
    .innerJoin(roomTypes, and(eq(roomTypes.id, bookings.roomTypeId), eq(roomTypes.orgId, ctx.org.id)))
    .where(and(eq(bookings.orgId, ctx.org.id), eq(bookings.guestId, id)))
    .orderBy(desc(bookings.checkIn))
    .limit(50);

  return { ...g, history };
}

export type GuestRow = Awaited<ReturnType<typeof listGuests>>[number];
export type GuestDetail = NonNullable<Awaited<ReturnType<typeof getGuestDetail>>>;
