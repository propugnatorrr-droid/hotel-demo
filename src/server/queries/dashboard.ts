import 'server-only';
import { and, asc, desc, eq, gte, inArray, isNull, notInArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { alerts, bookings, conversations, guests, housekeepingTasks, rooms, roomTypes } from '@/db/schema';
import type { alertSeverity, bookingSource, roomStatus } from '@/db/schema/enums';
import type { OrgContext } from '@/lib/auth/session';
import { addDays, todayIn } from '@/lib/dates';

export type RoomStatus = (typeof roomStatus.enumValues)[number];
export type BookingSource = (typeof bookingSource.enumValues)[number];
export type Severity = (typeof alertSeverity.enumValues)[number];

export type DayPoint = { day: string; rooms: number; fb: number; spa: number; total: number; occupied: number };
export type ForecastPoint = { day: string; occupied: number; occupancy: number };
export type ChannelRow = { source: BookingSource; n: number; amount: number; commission: number };

const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (v: number) => Math.round(v * 100) / 100;
const SEVERITY_RANK: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };

function movements(orgId: string, today: string, kind: 'arrivals' | 'departures') {
  const where =
    kind === 'arrivals'
      ? and(
          eq(bookings.orgId, orgId),
          eq(bookings.checkIn, today),
          inArray(bookings.status, ['tentative', 'confirmed', 'checked_in']),
        )
      : and(eq(bookings.orgId, orgId), eq(bookings.checkOut, today), inArray(bookings.status, ['checked_in', 'checked_out']));

  return db
    .select({
      id: bookings.id,
      code: bookings.code,
      status: bookings.status,
      source: bookings.source,
      checkIn: bookings.checkIn,
      checkOut: bookings.checkOut,
      adults: bookings.adults,
      children: bookings.children,
      eta: bookings.eta,
      total: bookings.totalAmount,
      paid: bookings.paidAmount,
      firstName: guests.firstName,
      lastName: guests.lastName,
      isVip: guests.isVip,
      nationality: guests.nationality,
      roomNumber: rooms.number,
      roomTypeName: roomTypes.name,
    })
    .from(bookings)
    .innerJoin(guests, eq(guests.id, bookings.guestId))
    .innerJoin(roomTypes, eq(roomTypes.id, bookings.roomTypeId))
    .leftJoin(rooms, eq(rooms.id, bookings.roomId))
    .where(where)
    .orderBy(asc(bookings.status), asc(bookings.eta), asc(guests.lastName));
}

export type Movement = Awaited<ReturnType<typeof movements>>[number];

export async function getDashboard(ctx: OrgContext) {
  const orgId = ctx.org.id;
  const tz = ctx.org.timezone;
  const today = todayIn(tz);
  const from = addDays(today, -14);
  const since30 = new Date(Date.now() - 30 * 86_400_000);

  const [seriesRows, forecastRows, roomRows, hkRows, arrivals, departures, inHouseRows, alertRows, inboxRows, channelRows] =
    await Promise.all([
      db.execute<{ day: string; rooms: string; occupied: number; fb: string; spa: string }>(sql`
        with days as (
          select g::date as d from generate_series(${from}::date, ${today}::date, interval '1 day') as g
        ),
        r as (
          select days.d,
                 coalesce(sum(b.total_amount / greatest(b.check_out - b.check_in, 1)), 0) as v,
                 count(b.id)::int as occupied
          from days
          left join bookings b
            on b.org_id = ${orgId}
           and b.status in ('checked_in', 'checked_out')
           and b.check_in <= days.d
           and b.check_out > days.d
          group by days.d
        ),
        f as (
          select (paid_at at time zone ${tz})::date as d, sum(total) as v
          from pos_orders
          where org_id = ${orgId} and status = 'paid' and paid_at is not null
          group by 1
        ),
        s as (
          select (starts_at at time zone ${tz})::date as d, sum(price) as v
          from spa_appointments
          where org_id = ${orgId} and status = 'completed'
          group by 1
        )
        select to_char(days.d, 'YYYY-MM-DD') as day,
               r.v as rooms,
               r.occupied,
               coalesce(f.v, 0) as fb,
               coalesce(s.v, 0) as spa
        from days
        join r on r.d = days.d
        left join f on f.d = days.d
        left join s on s.d = days.d
        order by days.d
      `),
      db.execute<{ day: string; occupied: number }>(sql`
        select to_char(g.d::date, 'YYYY-MM-DD') as day, count(b.id)::int as occupied
        from generate_series(${today}::date, ${today}::date + 6, interval '1 day') as g(d)
        left join bookings b
          on b.org_id = ${orgId}
         and b.status in ('tentative', 'confirmed', 'checked_in')
         and b.check_in <= g.d::date
         and b.check_out > g.d::date
        group by g.d
        order by g.d
      `),
      db
        .select({ status: rooms.status, n: sql<number>`count(*)::int` })
        .from(rooms)
        .where(and(eq(rooms.orgId, orgId), eq(rooms.isActive, true)))
        .groupBy(rooms.status),
      db
        .select({ status: housekeepingTasks.status, n: sql<number>`count(*)::int` })
        .from(housekeepingTasks)
        .where(and(eq(housekeepingTasks.orgId, orgId), eq(housekeepingTasks.dueDate, today)))
        .groupBy(housekeepingTasks.status),
      movements(orgId, today, 'arrivals'),
      movements(orgId, today, 'departures'),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(bookings)
        .where(and(eq(bookings.orgId, orgId), eq(bookings.status, 'checked_in'))),
      db
        .select({
          id: alerts.id,
          type: alerts.type,
          severity: alerts.severity,
          title: alerts.title,
          body: alerts.body,
          createdAt: alerts.createdAt,
        })
        .from(alerts)
        .where(and(eq(alerts.orgId, orgId), isNull(alerts.resolvedAt)))
        .orderBy(desc(alerts.createdAt))
        .limit(8),
      db
        .select({ n: sql<number>`count(*)::int` })
        .from(conversations)
        .where(and(eq(conversations.orgId, orgId), eq(conversations.status, 'needs_human'))),
      db
        .select({
          source: bookings.source,
          n: sql<number>`count(*)::int`,
          amount: sql<number>`coalesce(sum(${bookings.totalAmount}), 0)::float8`,
          commission: sql<number>`coalesce(sum(${bookings.commissionAmount}), 0)::float8`,
        })
        .from(bookings)
        .where(
          and(
            eq(bookings.orgId, orgId),
            gte(bookings.createdAt, since30),
            notInArray(bookings.status, ['cancelled', 'no_show']),
          ),
        )
        .groupBy(bookings.source),
    ]);

  const series: DayPoint[] = [...seriesRows].map((r) => {
    const roomsV = r2(num(r.rooms));
    const fb = r2(num(r.fb));
    const spa = r2(num(r.spa));
    return { day: r.day, rooms: roomsV, fb, spa, total: r2(roomsV + fb + spa), occupied: num(r.occupied) };
  });

  const byStatus: Record<RoomStatus, number> = { clean: 0, dirty: 0, inspected: 0, out_of_order: 0 };
  for (const r of roomRows) byStatus[r.status] = r.n;
  const totalRooms = Object.values(byStatus).reduce((a, b) => a + b, 0);
  const sellable = Math.max(1, totalRooms - byStatus.out_of_order);

  const forecast: ForecastPoint[] = [...forecastRows].map((r) => ({
    day: r.day,
    occupied: num(r.occupied),
    occupancy: Math.min(100, Math.round((num(r.occupied) / sellable) * 100)),
  }));
  const tonight = forecast[0] ?? { day: today, occupied: 0, occupancy: 0 };

  const y = series[series.length - 2];
  const lastWeek = series[series.length - 9];
  const changePct = y && lastWeek && lastWeek.total > 0 ? Math.round(((y.total - lastWeek.total) / lastWeek.total) * 100) : null;

  const housekeeping = { open: 0, inProgress: 0, done: 0 };
  for (const r of hkRows) {
    if (r.status === 'open') housekeeping.open = r.n;
    else if (r.status === 'in_progress') housekeeping.inProgress = r.n;
    else if (r.status === 'done') housekeeping.done = r.n;
  }

  const openAlerts = [...alertRows].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.createdAt.getTime() - a.createdAt.getTime(),
  );

  const channels: ChannelRow[] = channelRows
    .map((r) => ({ source: r.source, n: r.n, amount: num(r.amount), commission: num(r.commission) }))
    .sort((a, b) => b.amount - a.amount);

  return {
    today,
    series,
    forecast,
    rooms: { total: totalRooms, sellable, byStatus },
    tonight,
    arrivals,
    departures,
    inHouse: inHouseRows[0]?.n ?? 0,
    housekeeping,
    alerts: openAlerts,
    needsHuman: inboxRows[0]?.n ?? 0,
    channels,
    yesterday: {
      total: y?.total ?? 0,
      rooms: y?.rooms ?? 0,
      occupied: y?.occupied ?? 0,
      adr: y && y.occupied > 0 ? r2(y.rooms / y.occupied) : 0,
      revpar: y ? r2(y.rooms / sellable) : 0,
      changePct,
    },
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;
