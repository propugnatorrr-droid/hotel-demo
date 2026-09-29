import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db';

type Billing = { paidUntil?: string; payments?: { date: string; amount: number; currency: string; months: number; note?: string }[] };

export async function getAdminOverview() {
  const rows = (await db.execute(sql`
    select o.id, o.name, o.slug, o.city, o.plan::text as plan, o.status::text as status, o.is_demo, o.currency::text as currency, o.settings, o.created_at,
      (select count(*) from memberships m where m.org_id = o.id and m.is_active) as users,
      (select count(*) from rooms r where r.org_id = o.id and r.is_active) as rooms,
      (select count(*) from bookings b where b.org_id = o.id and b.created_at > now() - interval '30 days') as bookings30,
      (select count(*) from audit_logs a where a.org_id = o.id and a.action like 'ai.%' and a.created_at > now() - interval '30 days') as ai30,
      (select max(a.created_at) from audit_logs a where a.org_id = o.id) as last_activity,
      coalesce((select array_agg(om.module::text) from org_modules om where om.org_id = o.id and om.enabled), '{}') as modules
    from organizations o order by o.created_at desc`)) as unknown as {
    id: string; name: string; slug: string; city: string | null; plan: string; status: string; is_demo: boolean; currency: string; settings: { billing?: Billing };
    created_at: string; users: string; rooms: string; bookings30: string; ai30: string; last_activity: string | null; modules: string[];
  }[];

  return rows.map((r) => ({
    id: r.id, name: r.name, slug: r.slug, city: r.city, plan: r.plan, status: r.status, isDemo: r.is_demo, currency: r.currency,
    users: Number(r.users), rooms: Number(r.rooms), bookings30: Number(r.bookings30), ai30: Number(r.ai30),
    lastActivity: r.last_activity ? new Date(r.last_activity).toISOString() : null,
    createdAt: new Date(r.created_at).toISOString(),
    modules: r.modules,
    billing: { paidUntil: r.settings?.billing?.paidUntil ?? null, payments: r.settings?.billing?.payments ?? [] },
  }));
}

export type AdminHotel = Awaited<ReturnType<typeof getAdminOverview>>[number];
