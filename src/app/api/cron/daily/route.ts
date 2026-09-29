import { eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { orgModules, organizations } from '@/db/schema';
import type { OrgContext } from '@/lib/auth/session';
import { detectAnomalies, raisePricingAlerts } from '@/server/services/anomalies';
import { runJourney } from '@/server/services/journey';
import { buildMorningReport, deliverMorningReport, ownerOf } from '@/server/services/morning-report';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Daily 05:00 UTC job: guest journey messages, anomaly checks, pricing alerts, owner morning report. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const orgs = await db.select().from(organizations).where(inArray(organizations.status, ['demo', 'trial', 'active']));
  const results: Record<string, unknown>[] = [];

  for (const org of orgs) {
    const r: Record<string, unknown> = { org: org.slug };
    try {
      const mods = await db.select({ module: orgModules.module, enabled: orgModules.enabled }).from(orgModules).where(eq(orgModules.orgId, org.id));
      const modules = new Set(mods.filter((m) => m.enabled).map((m) => m.module));
      const owner = await ownerOf(org.id);

      if (modules.has('inbox') || modules.has('pms')) r.journey = await runJourney(org);
      r.anomalies = await detectAnomalies(org);

      if (owner) {
        const ctx: OrgContext = { user: { id: owner.id, email: owner.email }, profile: owner, org, role: 'owner', orgs: [], modules };
        if (modules.has('owner_ai')) {
          r.pricing = await raisePricingAlerts(ctx);
          const report = await buildMorningReport(ctx, org.defaultLocale === 'en' ? 'en' : 'sq');
          r.delivered = await deliverMorningReport(ctx, report);
        }
      }
    } catch (e) {
      console.error('[cron/daily]', org.slug, e);
      r.error = e instanceof Error ? e.message : 'failed';
    }
    results.push(r);
  }
  return Response.json({ ok: true, results });
}
