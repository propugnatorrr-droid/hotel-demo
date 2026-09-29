import 'server-only';
import { and, count, eq, gte } from 'drizzle-orm';
import { db } from '@/db';
import { auditLogs } from '@/db/schema';

/**
 * Per-user hourly budget guard backed by audit_logs. Records the request when allowed.
 * Returns false when the limit is reached.
 */
export async function takeAiBudget(orgId: string, userId: string | null, kind: string, perHour: number) {
  const since = new Date(Date.now() - 3_600_000);
  const where = [eq(auditLogs.orgId, orgId), eq(auditLogs.action, `ai.${kind}`), gte(auditLogs.createdAt, since)];
  if (userId) where.push(eq(auditLogs.userId, userId));
  const [row] = await db.select({ n: count() }).from(auditLogs).where(and(...where));
  if ((row?.n ?? 0) >= perHour) return false;
  await db.insert(auditLogs).values({ orgId, userId, action: `ai.${kind}`, entityType: 'ai', meta: {} });
  return true;
}
