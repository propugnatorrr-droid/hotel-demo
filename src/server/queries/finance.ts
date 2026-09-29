import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import type { OrgContext } from '@/lib/auth/session';
import { DEFAULT_ALL_PER_EUR, DEFAULT_ALL_PER_USD } from '@/config/expenses';

const num = (v: unknown) => (v == null ? 0 : Number(v));
const r2 = (v: number) => Math.round(v * 100) / 100;

export function fxToOrg(ctx: OrgContext) {
  const perEur = Number(ctx.org.settings.fxAllPerEur) || DEFAULT_ALL_PER_EUR;
  const perUsd = Number(ctx.org.settings.fxAllPerUsd) || DEFAULT_ALL_PER_USD;
  const perUnit = { ALL: 1, EUR: perEur, USD: perUsd } as const;
  const target = perUnit[ctx.org.currency];
  return (amount: number, from: 'ALL' | 'EUR' | 'USD') => (amount * perUnit[from]) / target;
}

export type MonthRow = { month: string; rooms: number; fb: number; spa: number; income: number; expenses: number; profit: number; byDept: Record<string, number> };

/** Income (accrual for rooms, cash-basis for F&B/spa) versus expenses per month, in the hotel currency. */
export async function getProfit(ctx: OrgContext, months = 6): Promise<{ months: MonthRow[]; fx: number }> {
  const orgId = ctx.org.id;
  const tz = ctx.org.timezone;
  const convert = fxToOrg(ctx);

  const from = sql`(date_trunc('month', (now() at time zone ${tz})) - make_interval(months => ${months - 1}))::date`;

  const [rooms, fb, spa, exp] = await Promise.all([
    db.execute(sql`
      select to_char(date_trunc('month', d), 'YYYY-MM') as m, sum(b.total_amount / greatest(1, (b.check_out - b.check_in))) as v
      from bookings b, generate_series(b.check_in::timestamp, (b.check_out - 1)::timestamp, interval '1 day') d
      where b.org_id = ${orgId} and b.status in ('confirmed','checked_in','checked_out') and d::date >= ${from}
      group by 1`),
    db.execute(sql`
      select m, sum(v) as v from (
        select to_char(date_trunc('month', fi.posted_at at time zone ${tz}), 'YYYY-MM') as m, fi.amount as v
        from folio_items fi where fi.org_id = ${orgId} and fi.type in ('restaurant','bar','pool_bar','room_service','minibar','service') and (fi.posted_at at time zone ${tz})::date >= ${from}
        union all
        select to_char(date_trunc('month', po.paid_at at time zone ${tz}), 'YYYY-MM'), po.total
        from pos_orders po where po.org_id = ${orgId} and po.status = 'paid' and po.payment_method in ('cash','card') and (po.paid_at at time zone ${tz})::date >= ${from}
      ) x group by m`),
    db.execute(sql`
      select m, sum(v) as v from (
        select to_char(date_trunc('month', fi.posted_at at time zone ${tz}), 'YYYY-MM') as m, fi.amount as v
        from folio_items fi where fi.org_id = ${orgId} and fi.type = 'spa' and (fi.posted_at at time zone ${tz})::date >= ${from}
        union all
        select to_char(date_trunc('month', sa.starts_at at time zone ${tz}), 'YYYY-MM'), sa.price
        from spa_appointments sa where sa.org_id = ${orgId} and sa.status = 'completed' and sa.charged_to_folio = false and (sa.starts_at at time zone ${tz})::date >= ${from}
      ) x group by m`),
    db.execute(sql`
      select to_char(date_trunc('month', e.expense_date), 'YYYY-MM') as m, e.department::text as dept, e.currency::text as cur, sum(e.amount) as v
      from expenses e where e.org_id = ${orgId} and e.expense_date >= ${from}
      group by 1, 2, 3`),
  ]);

  const now = new Date();
  const keys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    keys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  const pick = (rows: unknown, key: string) => (rows as { m: string; v: unknown }[]).find((r) => r.m === key)?.v;
  const out: MonthRow[] = keys.map((k) => {
    const byDept: Record<string, number> = {};
    for (const r of exp as unknown as { m: string; dept: string; cur: 'ALL' | 'EUR' | 'USD'; v: unknown }[]) {
      if (r.m === k) byDept[r.dept] = (byDept[r.dept] ?? 0) + convert(num(r.v), r.cur);
    }
    const expenses = r2(Object.values(byDept).reduce((s, v) => s + v, 0));
    const roomsV = r2(num(pick(rooms, k)));
    const fbV = r2(num(pick(fb, k)));
    const spaV = r2(num(pick(spa, k)));
    const income = r2(roomsV + fbV + spaV);
    return { month: k, rooms: roomsV, fb: fbV, spa: spaV, income, expenses, profit: r2(income - expenses), byDept: Object.fromEntries(Object.entries(byDept).map(([a, b]) => [a, r2(b)])) };
  });
  return { months: out, fx: Number(ctx.org.settings.fxAllPerEur) || DEFAULT_ALL_PER_EUR };
}
