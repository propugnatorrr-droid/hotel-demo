import { and, eq, isNotNull } from 'drizzle-orm';
import { db } from '@/db';
import { channelMappings, organizations } from '@/db/schema';
import { pushChannel, syncIcalMapping } from '@/server/services/channel-sync';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Vercel Cron: pulls every iCal feed and pushes availability. Protected by CRON_SECRET. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rows = await db
    .select({ id: channelMappings.id, orgId: channelMappings.orgId, tz: organizations.timezone, currency: organizations.currency, status: organizations.status })
    .from(channelMappings)
    .innerJoin(organizations, eq(organizations.id, channelMappings.orgId))
    .where(and(isNotNull(channelMappings.icalImportUrl), eq(channelMappings.isActive, true)));

  let synced = 0;
  for (const r of rows) {
    if (r.status === 'suspended') continue;
    await syncIcalMapping(r.orgId, r.id, r.tz, r.currency);
    synced++;
  }
  const orgs = [...new Set(rows.map((r) => r.orgId))];
  for (const orgId of orgs) await pushChannel(orgId);
  return Response.json({ ok: true, feeds: synced, orgs: orgs.length });
}
