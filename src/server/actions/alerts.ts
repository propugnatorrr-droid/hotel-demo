'use server';

import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { alerts } from '@/db/schema';
import { audit, fail, gate, MANAGERS, run, type ActionResult } from './kit';
import { setRates } from './calendar';

export async function resolveAlert(alertId: string): Promise<ActionResult> {
  return run(async () => {
    const ctx = await gate(MANAGERS);
    const [a] = await db
      .update(alerts)
      .set({ resolvedAt: new Date(), resolvedBy: ctx.user.id, isRead: true })
      .where(and(eq(alerts.orgId, ctx.org.id), eq(alerts.id, z.uuid().parse(alertId))))
      .returning({ id: alerts.id, type: alerts.type });
    if (!a) fail('notFound');
    await audit(db, ctx, 'alert.resolved', 'alert', a.id, { type: a.type });
    return null;
  });
}

/** One-click: applies a pricing suggestion to daily_rates and closes the alert. */
export async function applyPricingSuggestion(alertId: string): Promise<ActionResult<{ days: number }>> {
  return run(async () => {
    const ctx = await gate(MANAGERS, 'calendar');
    const id = z.uuid().parse(alertId);
    const [a] = await db.select().from(alerts).where(and(eq(alerts.orgId, ctx.org.id), eq(alerts.id, id), eq(alerts.type, 'pricing_suggestion'))).limit(1);
    if (!a?.data) fail('notFound');
    const d = z.object({ roomTypeId: z.uuid(), from: z.iso.date(), to: z.iso.date(), changePct: z.number() }).safeParse(a.data);
    if (!d.success) fail('invalid');
    const res = await setRates({ roomTypeId: d.data.roomTypeId, from: d.data.from, to: d.data.to, adjustPct: d.data.changePct });
    if (!res.ok) fail(res.error);
    await db.update(alerts).set({ resolvedAt: new Date(), resolvedBy: ctx.user.id }).where(eq(alerts.id, a.id));
    return { days: res.data.days };
  });
}
