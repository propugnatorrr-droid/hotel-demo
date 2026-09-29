import 'server-only';
import { and, eq, gte, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { alerts, auditLogs, payments, profiles } from '@/db/schema';
import type { organizations } from '@/db/schema';
import { addDays, todayIn } from '@/lib/dates';
import { getPricingSuggestions } from '@/server/queries/analytics';
import type { OrgContext } from '@/lib/auth/session';

type Org = typeof organizations.$inferSelect;

async function raise(orgId: string, a: { type: string; severity: 'info' | 'warning' | 'critical'; title: string; body?: string; entityType?: string; entityId?: string | null; data?: Record<string, unknown> }) {
  // Dedupe: one unresolved alert per (type, entity) or (type, title) for non-entity alerts.
  const [dupe] = await db
    .select({ id: alerts.id })
    .from(alerts)
    .where(and(eq(alerts.orgId, orgId), eq(alerts.type, a.type), isNull(alerts.resolvedAt), a.entityId ? eq(alerts.entityId, a.entityId) : eq(alerts.title, a.title)))
    .limit(1);
  if (dupe) return false;
  await db.insert(alerts).values({ orgId, type: a.type, severity: a.severity, title: a.title, body: a.body ?? null, entityType: a.entityType ?? null, entityId: a.entityId ?? null, data: a.data ?? null });
  return true;
}

/** Rule-based fraud and anomaly checks over the last 24 hours. Idempotent. */
export async function detectAnomalies(org: Org) {
  const since = new Date(Date.now() - 24 * 3_600_000);
  let raised = 0;

  // Large POS discounts.
  const discounts = await db
    .select({ id: auditLogs.entityId, meta: auditLogs.meta, user: profiles.fullName })
    .from(auditLogs)
    .leftJoin(profiles, eq(profiles.id, auditLogs.userId))
    .where(and(eq(auditLogs.orgId, org.id), eq(auditLogs.action, 'pos.discount_applied'), gte(auditLogs.createdAt, since)));
  for (const d of discounts) {
    const pct = Number((d.meta as { percent?: number }).percent ?? 0);
    if (pct > 20 && d.id && (await raise(org.id, { type: 'unusual_discount', severity: pct >= 40 ? 'critical' : 'warning', title: `Zbritje e pazakontë ${pct}%`, body: `${d.user ?? 'Staf'} aplikoi ${pct}% në një porosi.`, entityType: 'pos_order', entityId: d.id, data: { percent: pct } }))) raised++;
  }

  // Voided paid orders, grouped by staff member.
  const voids = await db
    .select({ user: auditLogs.userId, name: profiles.fullName, n: sql<number>`count(*)`.mapWith(Number), total: sql<number>`coalesce(sum((${auditLogs.meta}->>'total')::numeric),0)`.mapWith(Number) })
    .from(auditLogs)
    .leftJoin(profiles, eq(profiles.id, auditLogs.userId))
    .where(and(eq(auditLogs.orgId, org.id), eq(auditLogs.action, 'pos.order_voided'), sql`(${auditLogs.meta}->>'wasPaid')::boolean = true`, gte(auditLogs.createdAt, since)))
    .groupBy(auditLogs.userId, profiles.fullName);
  for (const v of voids) {
    if (v.n >= 2 && (await raise(org.id, { type: 'repeated_voids', severity: 'warning', title: `${v.n} porosi të paguara u anuluan nga ${v.name ?? 'stafi'}`, body: `Vlera gjithsej ${v.total.toFixed(2)}. Kontrolloje.`, entityType: 'profile', entityId: v.user }))) raised++;
  }

  // Cancelled invoices.
  const [cinv] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(auditLogs)
    .where(and(eq(auditLogs.orgId, org.id), eq(auditLogs.action, 'invoice.cancelled'), gte(auditLogs.createdAt, since)));
  if ((cinv?.n ?? 0) >= 2 && (await raise(org.id, { type: 'invoice_cancellations', severity: 'warning', title: `${cinv!.n} fatura u anuluan brenda 24 orësh`, body: 'Shiko historikun e faturave.' }))) raised++;

  // Large refunds.
  const refunds = await db
    .select({ id: payments.id, amount: payments.amount })
    .from(payments)
    .where(and(eq(payments.orgId, org.id), eq(payments.isRefund, true), gte(payments.receivedAt, since), sql`${payments.amount} >= 150`));
  for (const r of refunds) {
    if (await raise(org.id, { type: 'large_refund', severity: 'warning', title: `Rimbursim i madh: ${r.amount.toFixed(2)}`, entityType: 'payment', entityId: r.id })) raised++;
  }
  return raised;
}

/** Turns the pricing rules into actionable alerts (the owner applies them in one click). */
export async function raisePricingAlerts(ctx: OrgContext) {
  const today = todayIn(ctx.org.timezone);
  const list = await getPricingSuggestions(ctx, today);
  let n = 0;
  for (const s of list.slice(0, 6)) {
    const up = s.changePct > 0;
    const title = up ? `Kërkesë e lartë: ${s.roomType}` : `Kërkesë e ulët: ${s.roomType}`;
    const raisedNow = await raise(ctx.org.id, {
      type: 'pricing_suggestion', severity: 'info',
      title: `${title} (${s.from} → ${s.to})`,
      body: up ? `Pushtimi mesatar është ${s.avgOccupancy}%. Rrit çmimet ${s.changePct}%.` : `Pushtimi mesatar është vetëm ${s.avgOccupancy}%. Ul çmimet ${Math.abs(s.changePct)}% për t’i mbushur netët.`,
      data: { roomTypeId: s.roomTypeId, from: s.from, to: s.to, changePct: s.changePct },
    });
    if (raisedNow) n++;
  }
  // Suggestions in the past are no longer useful.
  await db.update(alerts).set({ resolvedAt: new Date() }).where(and(eq(alerts.orgId, ctx.org.id), eq(alerts.type, 'pricing_suggestion'), isNull(alerts.resolvedAt), sql`(${alerts.data}->>'to') < ${addDays(today, 0)}`));
  return n;
}
