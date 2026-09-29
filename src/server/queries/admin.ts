import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db';
import { CHANNEX_MIN_HOTELS, usageEconomics, sizeForRooms, type PlanKey } from '@/config/plans';

type Billing = { paidUntil?: string; payments?: { date: string; amount: number; currency: string; months: number; note?: string }[] };

export async function getAdminOverview() {
  const rows = (await db.execute(sql`
    select o.id, o.name, o.slug, o.city, o.plan::text as plan, o.status::text as status, o.is_demo, o.currency::text as currency, o.settings, o.created_at,
      (select count(*) from memberships m where m.org_id = o.id and m.is_active) as users,
      (select count(*) from rooms r where r.org_id = o.id and r.is_active) as rooms,
      (select count(*) from bookings b where b.org_id = o.id and b.created_at > now() - interval '30 days') as bookings30,
      (select count(*) from audit_logs a where a.org_id = o.id and a.action like 'ai.%' and a.created_at > now() - interval '30 days') as ai30,
      (select max(a.created_at) from audit_logs a where a.org_id = o.id) as last_activity,
      (select count(*) from messages m join conversations c on c.id = m.conversation_id where m.org_id = o.id and c.channel = 'whatsapp' and m.direction = 'outbound' and m.created_at > now() - interval '30 days') as wa30,
      (select coalesce(sum(cl.duration_sec),0) from call_logs cl where cl.org_id = o.id and cl.created_at > now() - interval '30 days') as voice_sec30,
      exists (select 1 from integrations i where i.org_id = o.id and i.provider = 'channex' and i.mode <> 'mock' and i.is_enabled) as realtime,
      coalesce((select array_agg(om.module::text) from org_modules om where om.org_id = o.id and om.enabled), '{}') as modules
    from organizations o order by o.created_at desc`)) as unknown as {
    id: string; name: string; slug: string; city: string | null; plan: string; status: string; is_demo: boolean; currency: string; settings: { billing?: Billing; realtimeSyncAddon?: boolean; founding?: boolean };
    created_at: string; wa30: string; voice_sec30: string; realtime: boolean; users: string; rooms: string; bookings30: string; ai30: string; last_activity: string | null; modules: string[];
  }[];

  const realtimeHotels = rows.filter((r) => r.realtime && !r.is_demo).length;
  return rows.map((r) => ({
    id: r.id, name: r.name, slug: r.slug, city: r.city, plan: r.plan, status: r.status, isDemo: r.is_demo, currency: r.currency,
    users: Number(r.users), rooms: Number(r.rooms), bookings30: Number(r.bookings30), ai30: Number(r.ai30),
    lastActivity: r.last_activity ? new Date(r.last_activity).toISOString() : null,
    createdAt: new Date(r.created_at).toISOString(),
    modules: r.modules,
    usage: { ai30: Number(r.ai30), whatsapp30: Number(r.wa30), voiceMin30: Math.round(Number(r.voice_sec30) / 60), realtime: r.realtime },
    economics: r.is_demo ? null : usageEconomics({ plan: r.plan as PlanKey, size: sizeForRooms(Number(r.rooms)), founding: (r.settings as { founding?: boolean })?.founding !== false, aiRequests: Number(r.ai30), whatsappMessages: Number(r.wa30), voiceMinutes: Math.round(Number(r.voice_sec30) / 60), realtimeSync: r.realtime }),
    flags: { realtimeSyncAddon: r.settings?.realtimeSyncAddon === true, founding: r.settings?.founding !== false },
    channexGate: { realtimeHotels, needed: CHANNEX_MIN_HOTELS },
    billing: { paidUntil: r.settings?.billing?.paidUntil ?? null, payments: r.settings?.billing?.payments ?? [] },
  }));
}

export type AdminHotel = Awaited<ReturnType<typeof getAdminOverview>>[number];
