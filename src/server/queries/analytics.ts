import 'server-only';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { alerts, rooms } from '@/db/schema';
import type { OrgContext } from '@/lib/auth/session';
import { addDays, diffDays } from '@/lib/dates';
import { fxToOrg } from './finance';

const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (v: number) => Math.round(v * 100) / 100;

type Rows<T> = T[];
async function q<T>(query: ReturnType<typeof sql>): Promise<Rows<T>> {
  return (await db.execute(query)) as unknown as Rows<T>;
}

/** Inclusive date range [from, to]. */
export async function getPeriodStats(ctx: OrgContext, from: string, to: string) {
  const orgId = ctx.org.id;
  const tz = ctx.org.timezone;
  const end = addDays(to, 1);
  const days = Math.max(1, diffDays(end, from));

  const [roomCount] = await db.select({ n: sql<number>`count(*)`.mapWith(Number) }).from(rooms).where(and(eq(rooms.orgId, orgId), eq(rooms.isActive, true)));
  const [stay] = await q<{ nights: string; revenue: string; bookings: string }>(sql`
    select coalesce(sum(1),0) as nights,
           coalesce(sum(b.total_amount / greatest(1,(b.check_out - b.check_in))),0) as revenue,
           count(distinct b.id) as bookings
    from bookings b, generate_series(b.check_in::timestamp, (b.check_out - 1)::timestamp, interval '1 day') d
    where b.org_id = ${orgId} and b.status in ('confirmed','checked_in','checked_out')
      and d::date >= ${from}::date and d::date < ${end}::date`);
  const [fbRow] = await q<{ v: string }>(sql`
    select coalesce(sum(v),0) as v from (
      select fi.amount as v from folio_items fi where fi.org_id = ${orgId} and fi.type in ('restaurant','bar','pool_bar','room_service','minibar','service') and (fi.posted_at at time zone ${tz})::date >= ${from}::date and (fi.posted_at at time zone ${tz})::date < ${end}::date
      union all
      select po.total from pos_orders po where po.org_id = ${orgId} and po.status = 'paid' and po.payment_method in ('cash','card') and (po.paid_at at time zone ${tz})::date >= ${from}::date and (po.paid_at at time zone ${tz})::date < ${end}::date
    ) x`);
  const [spaRow] = await q<{ v: string }>(sql`
    select coalesce(sum(v),0) as v from (
      select fi.amount as v from folio_items fi where fi.org_id = ${orgId} and fi.type = 'spa' and (fi.posted_at at time zone ${tz})::date >= ${from}::date and (fi.posted_at at time zone ${tz})::date < ${end}::date
      union all
      select sa.price from spa_appointments sa where sa.org_id = ${orgId} and sa.status = 'completed' and sa.charged_to_folio = false and (sa.starts_at at time zone ${tz})::date >= ${from}::date and (sa.starts_at at time zone ${tz})::date < ${end}::date
    ) x`);
  const [cx] = await q<{ created: string; cancelled: string; noshow: string }>(sql`
    select count(*) filter (where (b.created_at at time zone ${tz})::date >= ${from}::date and (b.created_at at time zone ${tz})::date < ${end}::date) as created,
           count(*) filter (where b.status = 'cancelled' and (b.cancelled_at at time zone ${tz})::date >= ${from}::date and (b.cancelled_at at time zone ${tz})::date < ${end}::date) as cancelled,
           count(*) filter (where b.status = 'no_show' and b.check_in >= ${from}::date and b.check_in < ${end}::date) as noshow
    from bookings b where b.org_id = ${orgId}`);

  const available = (roomCount?.n ?? 0) * days;
  const nights = num(stay?.nights);
  const roomRev = r2(num(stay?.revenue));
  const fb = r2(num(fbRow?.v));
  const spa = r2(num(spaRow?.v));
  return {
    from, to, days,
    rooms: roomCount?.n ?? 0,
    occupancy: available ? Math.round((nights / available) * 100) : 0,
    adr: nights ? r2(roomRev / nights) : 0,
    revpar: available ? r2(roomRev / available) : 0,
    roomRevenue: roomRev, fbRevenue: fb, spaRevenue: spa, totalRevenue: r2(roomRev + fb + spa),
    nights, bookings: num(stay?.bookings), newBookings: num(cx?.created), cancellations: num(cx?.cancelled), noShows: num(cx?.noshow),
    currency: ctx.org.currency,
  };
}

export async function getChannelBreakdown(ctx: OrgContext, from: string, to: string) {
  const end = addDays(to, 1);
  const rows = await q<{ source: string; nights: string; revenue: string; bookings: string; commission: string }>(sql`
    select b.source::text as source, count(*) as nights,
           sum(b.total_amount / greatest(1,(b.check_out - b.check_in))) as revenue,
           count(distinct b.id) as bookings,
           sum(b.commission_amount / greatest(1,(b.check_out - b.check_in))) as commission
    from bookings b, generate_series(b.check_in::timestamp, (b.check_out - 1)::timestamp, interval '1 day') d
    where b.org_id = ${ctx.org.id} and b.status in ('confirmed','checked_in','checked_out')
      and d::date >= ${from}::date and d::date < ${end}::date
    group by 1 order by revenue desc`);
  return rows.map((r) => ({ source: r.source, nights: num(r.nights), bookings: num(r.bookings), revenue: r2(num(r.revenue)), commission: r2(num(r.commission)) }));
}

export async function getOutletSales(ctx: OrgContext, from: string, to: string) {
  const end = addDays(to, 1);
  const tz = ctx.org.timezone;
  const rows = await q<{ outlet: string; type: string; total: string; orders: string }>(sql`
    select o.name->>'sq' as outlet, o.type::text as type, coalesce(sum(po.total),0) as total, count(*) as orders
    from pos_orders po join outlets o on o.id = po.outlet_id
    where po.org_id = ${ctx.org.id} and po.status = 'paid' and (po.paid_at at time zone ${tz})::date >= ${from}::date and (po.paid_at at time zone ${tz})::date < ${end}::date
    group by 1,2 order by total desc`);
  return rows.map((r) => ({ outlet: r.outlet, type: r.type, total: r2(num(r.total)), orders: num(r.orders) }));
}

export async function getExpensesByDept(ctx: OrgContext, from: string, to: string) {
  const convert = fxToOrg(ctx);
  const rows = await q<{ dept: string; cur: 'ALL' | 'EUR' | 'USD'; v: string }>(sql`
    select e.department::text as dept, e.currency::text as cur, sum(e.amount) as v from expenses e
    where e.org_id = ${ctx.org.id} and e.expense_date >= ${from}::date and e.expense_date <= ${to}::date group by 1,2`);
  const by: Record<string, number> = {};
  for (const r of rows) by[r.dept] = (by[r.dept] ?? 0) + convert(num(r.v), r.cur);
  const list = Object.entries(by).map(([dept, v]) => ({ dept, total: r2(v) })).sort((a, b) => b.total - a.total);
  return { total: r2(list.reduce((s, x) => s + x.total, 0)), byDepartment: list };
}

/** Occupied rooms per day (per room type) for a window, used for forecast and pricing suggestions. */
export async function getOccupancyByDay(ctx: OrgContext, from: string, days: number) {
  const end = addDays(from, days);
  const [types, occ] = await Promise.all([
    q<{ id: string; code: string; name: string; rooms: string; base: string }>(sql`
      select t.id, t.code, t.name->>'sq' as name, count(r.id) filter (where r.is_active and r.status <> 'out_of_order') as rooms, t.base_price as base
      from room_types t left join rooms r on r.room_type_id = t.id where t.org_id = ${ctx.org.id} and t.is_active group by t.id`),
    q<{ type_id: string; d: string; n: string }>(sql`
      select b.room_type_id as type_id, to_char(d::date,'YYYY-MM-DD') as d, count(*) as n
      from bookings b, generate_series(b.check_in::timestamp, (b.check_out - 1)::timestamp, interval '1 day') d
      where b.org_id = ${ctx.org.id} and b.status in ('tentative','confirmed','checked_in') and d::date >= ${from}::date and d::date < ${end}::date group by 1,2`),
  ]);
  const map = new Map(occ.map((o) => [`${o.type_id}|${o.d}`, num(o.n)]));
  return types.map((t) => ({
    typeId: t.id, code: t.code, name: t.name, rooms: num(t.rooms), basePrice: num(t.base),
    days: Array.from({ length: days }, (_, i) => {
      const date = addDays(from, i);
      const occupied = map.get(`${t.id}|${date}`) ?? 0;
      return { date, occupied, occupancy: num(t.rooms) ? Math.round((occupied / num(t.rooms)) * 100) : 0 };
    }),
  }));
}

/** Simple, explainable rules: raise where demand is high, discount soon-to-be-empty nights. */
export async function getPricingSuggestions(ctx: OrgContext, today: string) {
  const data = await getOccupancyByDay(ctx, addDays(today, 1), 21);
  const out: { roomTypeId: string; roomType: string; from: string; to: string; changePct: number; reason: 'high_demand' | 'low_demand'; avgOccupancy: number }[] = [];
  for (const t of data) {
    if (t.rooms < 2) continue;
    const windows = [
      { from: 0, to: 6 },
      { from: 7, to: 13 },
      { from: 14, to: 20 },
    ];
    for (const w of windows) {
      const slice = t.days.slice(w.from, w.to + 1);
      const avg = Math.round(slice.reduce((s, d) => s + d.occupancy, 0) / slice.length);
      if (avg >= 85) out.push({ roomTypeId: t.typeId, roomType: t.name, from: slice[0]!.date, to: slice[slice.length - 1]!.date, changePct: avg >= 95 ? 15 : 10, reason: 'high_demand', avgOccupancy: avg });
      else if (w.from === 0 && avg <= 30) out.push({ roomTypeId: t.typeId, roomType: t.name, from: slice[0]!.date, to: slice[slice.length - 1]!.date, changePct: -10, reason: 'low_demand', avgOccupancy: avg });
    }
  }
  return out;
}

export async function getOpenAlerts(ctx: OrgContext, limit = 20) {
  const rows = await db.select().from(alerts).where(and(eq(alerts.orgId, ctx.org.id), sql`${alerts.resolvedAt} is null`)).orderBy(sql`${alerts.createdAt} desc`).limit(limit);
  return rows.map((a) => ({ id: a.id, type: a.type, severity: a.severity, title: a.title, body: a.body, createdAt: a.createdAt.toISOString() }));
}

export async function getTopGuests(ctx: OrgContext, limit = 10) {
  const rows = await q<{ name: string; stays: string; spent: string; last: string }>(sql`
    select g.first_name || ' ' || g.last_name as name, count(*) as stays, sum(b.total_amount) as spent, max(b.check_out)::text as last
    from bookings b join guests g on g.id = b.guest_id
    where b.org_id = ${ctx.org.id} and b.status in ('checked_in','checked_out') and g.tags <> array['channel']::text[]
    group by g.id order by spent desc limit ${limit}`);
  return rows.map((r) => ({ name: r.name, stays: num(r.stays), spent: r2(num(r.spent)), lastStay: r.last }));
}
