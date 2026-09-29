import 'server-only';
import { and, desc, eq, gte, lt, notLike, sql } from 'drizzle-orm';
import { db } from '@/db';
import { auditLogs, profiles } from '@/db/schema';
import type { OrgContext } from '@/lib/auth/session';
import { addDays } from '@/lib/dates';
import { getChannelBreakdown, getExpensesByDept, getOutletSales, getPeriodStats } from './analytics';

const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (v: number) => Math.round(v * 100) / 100;

export async function getDailySeries(ctx: OrgContext, from: string, to: string) {
  const end = addDays(to, 1);
  const tz = ctx.org.timezone;
  const rows = (await db.execute(sql`
    with days as (select d::date as day from generate_series(${from}::date, ${to}::date, interval '1 day') d),
    r as (
      select d::date as day, sum(b.total_amount / greatest(1,(b.check_out - b.check_in))) as v, count(*) as n
      from bookings b, generate_series(b.check_in::timestamp, (b.check_out - 1)::timestamp, interval '1 day') d
      where b.org_id = ${ctx.org.id} and b.status in ('confirmed','checked_in','checked_out') and d::date >= ${from}::date and d::date < ${end}::date group by 1),
    f as (
      select day, sum(v) as v from (
        select (fi.posted_at at time zone ${tz})::date as day, fi.amount as v from folio_items fi where fi.org_id = ${ctx.org.id} and fi.type in ('restaurant','bar','pool_bar','room_service','minibar','service')
        union all select (po.paid_at at time zone ${tz})::date, po.total from pos_orders po where po.org_id = ${ctx.org.id} and po.status = 'paid' and po.payment_method in ('cash','card')) x
      where day >= ${from}::date and day < ${end}::date group by 1),
    s as (
      select day, sum(v) as v from (
        select (fi.posted_at at time zone ${tz})::date as day, fi.amount as v from folio_items fi where fi.org_id = ${ctx.org.id} and fi.type = 'spa'
        union all select (sa.starts_at at time zone ${tz})::date, sa.price from spa_appointments sa where sa.org_id = ${ctx.org.id} and sa.status = 'completed' and sa.charged_to_folio = false) x
      where day >= ${from}::date and day < ${end}::date group by 1)
    select to_char(days.day,'YYYY-MM-DD') as day, coalesce(r.v,0) as rooms, coalesce(r.n,0) as occupied, coalesce(f.v,0) as fb, coalesce(s.v,0) as spa
    from days left join r on r.day = days.day left join f on f.day = days.day left join s on s.day = days.day order by days.day`)) as unknown as { day: string; rooms: string; occupied: string; fb: string; spa: string }[];
  return rows.map((r) => ({ day: r.day, rooms: r2(num(r.rooms)), fb: r2(num(r.fb)), spa: r2(num(r.spa)), occupied: num(r.occupied), total: r2(num(r.rooms) + num(r.fb) + num(r.spa)) }));
}

export async function getActivity(ctx: OrgContext, from: string, to: string, userId: string | null, limit = 120) {
  const end = addDays(to, 1);
  const rows = await db
    .select({ id: auditLogs.id, action: auditLogs.action, entityType: auditLogs.entityType, meta: auditLogs.meta, createdAt: auditLogs.createdAt, userId: auditLogs.userId, name: profiles.fullName })
    .from(auditLogs)
    .leftJoin(profiles, eq(profiles.id, auditLogs.userId))
    .where(and(eq(auditLogs.orgId, ctx.org.id), gte(auditLogs.createdAt, new Date(`${from}T00:00:00Z`)), lt(auditLogs.createdAt, new Date(`${end}T00:00:00Z`)), notLike(auditLogs.action, 'web.%'), notLike(auditLogs.action, 'email.%'), userId ? eq(auditLogs.userId, userId) : undefined))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
  const staff = await db
    .select({ id: profiles.id, name: profiles.fullName })
    .from(profiles)
    .innerJoin(sql`memberships m`, sql`m.user_id = ${profiles.id} and m.org_id = ${ctx.org.id}`)
    .orderBy(profiles.fullName);
  return { rows: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })), staff };
}

function prevRange(from: string, to: string) {
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
  return { from: addDays(from, -days), to: addDays(from, -1) };
}

export async function getReport(ctx: OrgContext, from: string, to: string, userId: string | null) {
  const prev = prevRange(from, to);
  const [stats, before, series, channels, outlets, expenses, activity] = await Promise.all([
    getPeriodStats(ctx, from, to),
    getPeriodStats(ctx, prev.from, prev.to),
    getDailySeries(ctx, from, to),
    getChannelBreakdown(ctx, from, to),
    getOutletSales(ctx, from, to),
    getExpensesByDept(ctx, from, to),
    getActivity(ctx, from, to, userId),
  ]);
  return { from, to, stats, before, series, channels, outlets, expenses, activity };
}

export type ReportData = Awaited<ReturnType<typeof getReport>>;
