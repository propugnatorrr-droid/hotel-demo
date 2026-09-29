import { and, eq } from 'drizzle-orm';
import { NextResponse, type NextRequest } from 'next/server';
import { db } from '@/db';
import { orgModules } from '@/db/schema';
import { pullChannex, pushAri } from '@/server/services/channex-sync';

export const maxDuration = 60;

// Safety net: pulls missed bookings and re-pushes ARI (skipped automatically when nothing changed).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const pulled = await pullChannex().catch((e) => {
    console.error('[cron] pull', e);
    return { applied: 0, failed: 0 };
  });
  const orgs = await db
    .select({ orgId: orgModules.orgId })
    .from(orgModules)
    .where(and(eq(orgModules.module, 'channel_manager'), eq(orgModules.enabled, true)));
  for (const { orgId } of orgs) {
    await pushAri(orgId, { availability: true, restrictions: true }).catch((e) => console.error('[cron] push', orgId, e));
  }
  return NextResponse.json({ pulled, orgs: orgs.length });
}
