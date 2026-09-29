'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/db';
import { auditLogs, integrations, memberships, messageTemplates, orgModules, organizations, profiles } from '@/db/schema';
import { ALL_MODULES, DEFAULT_TEMPLATES, PLAN_MODULES, type PlanKey } from '@/config/plans';
import { ACTIVE_ORG_COOKIE, requireUser } from '@/lib/auth/session';
import { env } from '@/lib/env';
import { createAdminClient } from '@/lib/supabase/admin';
import { ActionError, fail, run, type ActionResult } from './kit';

const PROVIDERS = ['channex', 'ical', 'meta_whatsapp', 'meta_instagram', 'meta_messenger', 'paysera', 'easypos', 'fature_al', 'vapi', 'resend', 'ai', 'telegram'] as const;
const plan = z.enum(['basic', 'pro', 'premium', 'enterprise']);

async function superAdmin() {
  const { profile } = await requireUser();
  if (!profile.isSuperAdmin) notFound();
  return profile;
}

async function adminRun<T>(fn: (p: Awaited<ReturnType<typeof superAdmin>>) => Promise<T>): Promise<ActionResult<T>> {
  return run(async () => fn(await superAdmin()), false).then((r) => {
    if (r.ok) revalidatePath('/[locale]/admin', 'layout');
    return r;
  });
}

async function applyPlanModules(orgId: string, key: PlanKey) {
  const on = new Set(PLAN_MODULES[key]);
  for (const m of ALL_MODULES) {
    await db.insert(orgModules).values({ orgId, module: m, enabled: on.has(m) }).onConflictDoUpdate({ target: [orgModules.orgId, orgModules.module], set: { enabled: on.has(m) } });
  }
}

export async function createHotel(input: unknown): Promise<ActionResult<{ id: string }>> {
  return adminRun(async (admin) => {
    const p = z
      .object({
        name: z.string().trim().min(2).max(120),
        slug: z.string().trim().toLowerCase().regex(/^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/),
        plan,
        city: z.string().trim().max(80).optional(),
        currency: z.enum(['EUR', 'ALL', 'USD']).default('EUR'),
        ownerEmail: z.email().max(160),
        ownerName: z.string().trim().min(2).max(100),
      })
      .parse(input);

    const [dupe] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, p.slug)).limit(1);
    if (dupe) fail('slugTaken');

    const [org] = await db
      .insert(organizations)
      .values({ name: p.name, slug: p.slug, city: p.city || null, currency: p.currency, plan: p.plan, status: 'trial', aiPersona: { name: 'Asistenti', tone: 'i ngrohtë, elegant, i shkurtër; përgjigjet në gjuhën e mysafirit' }, settings: { checkInTime: '14:00', checkOutTime: '11:00' } })
      .returning();
    await applyPlanModules(org!.id, p.plan);
    await db.insert(integrations).values(PROVIDERS.map((provider) => ({ orgId: org!.id, provider, mode: 'mock' as const })));
    await db.insert(messageTemplates).values(DEFAULT_TEMPLATES.map((t) => ({ orgId: org!.id, ...t })));

    // Owner: invite by email (or attach an existing account).
    let ownerId: string | undefined;
    const [existing] = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.email, p.ownerEmail.toLowerCase())).limit(1);
    if (existing) ownerId = existing.id;
    else {
      const { data, error } = await createAdminClient().auth.admin.inviteUserByEmail(p.ownerEmail, { data: { full_name: p.ownerName }, redirectTo: `${env.NEXT_PUBLIC_APP_URL}/login` });
      if (error || !data.user) throw new ActionError('inviteFailed');
      ownerId = data.user.id;
      await db.insert(profiles).values({ id: ownerId, email: p.ownerEmail.toLowerCase(), fullName: p.ownerName }).onConflictDoNothing();
    }
    await db.insert(memberships).values({ orgId: org!.id, userId: ownerId!, role: 'owner' }).onConflictDoNothing();
    await db.insert(auditLogs).values({ orgId: org!.id, userId: admin.id, action: 'admin.hotel_created', entityType: 'organization', entityId: org!.id, meta: { plan: p.plan } });
    return { id: org!.id };
  });
}

export async function setHotelPlan(input: unknown): Promise<ActionResult> {
  return adminRun(async (admin) => {
    const p = z.object({ orgId: z.uuid(), plan, applyModules: z.boolean().default(true) }).parse(input);
    await db.update(organizations).set({ plan: p.plan }).where(eq(organizations.id, p.orgId));
    if (p.applyModules) await applyPlanModules(p.orgId, p.plan);
    await db.insert(auditLogs).values({ orgId: p.orgId, userId: admin.id, action: 'admin.plan_changed', entityType: 'organization', entityId: p.orgId, meta: { plan: p.plan } });
    return null;
  });
}

export async function toggleHotelModule(input: unknown): Promise<ActionResult> {
  return adminRun(async (admin) => {
    const p = z.object({ orgId: z.uuid(), module: z.enum(ALL_MODULES as [string, ...string[]]), enabled: z.boolean() }).parse(input);
    await db
      .insert(orgModules)
      .values({ orgId: p.orgId, module: p.module as never, enabled: p.enabled })
      .onConflictDoUpdate({ target: [orgModules.orgId, orgModules.module], set: { enabled: p.enabled } });
    await db.insert(auditLogs).values({ orgId: p.orgId, userId: admin.id, action: 'admin.module_toggled', entityType: 'organization', entityId: p.orgId, meta: { module: p.module, enabled: p.enabled } });
    return null;
  });
}

export async function setHotelStatus(input: unknown): Promise<ActionResult> {
  return adminRun(async (admin) => {
    const p = z.object({ orgId: z.uuid(), status: z.enum(['demo', 'trial', 'active', 'suspended']) }).parse(input);
    await db.update(organizations).set({ status: p.status }).where(eq(organizations.id, p.orgId));
    await db.insert(auditLogs).values({ orgId: p.orgId, userId: admin.id, action: 'admin.status_changed', entityType: 'organization', entityId: p.orgId, meta: { status: p.status } });
    return null;
  });
}

type Billing = { paidUntil?: string; payments?: { date: string; amount: number; currency: string; months: number; note?: string }[] };

/** Cash-first billing (PLAN §3.2): the founder records a payment and paid-until moves forward. */
export async function recordHotelPayment(input: unknown): Promise<ActionResult<{ paidUntil: string }>> {
  return adminRun(async (admin) => {
    const p = z.object({ orgId: z.uuid(), amount: z.coerce.number().positive().max(1_000_000), currency: z.enum(['EUR', 'ALL', 'USD']), months: z.coerce.number().int().min(1).max(36), note: z.string().trim().max(200).optional() }).parse(input);
    const [org] = await db.select().from(organizations).where(eq(organizations.id, p.orgId)).limit(1);
    if (!org) fail('notFound');
    const billing = ((org.settings as { billing?: Billing }).billing ?? {}) as Billing;
    const today = new Date().toISOString().slice(0, 10);
    const startFrom = billing.paidUntil && billing.paidUntil > today ? billing.paidUntil : today;
    const d = new Date(`${startFrom}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + p.months);
    const paidUntil = d.toISOString().slice(0, 10);
    const next: Billing = { paidUntil, payments: [{ date: today, amount: p.amount, currency: p.currency, months: p.months, note: p.note }, ...(billing.payments ?? [])].slice(0, 60) };
    await db.update(organizations).set({ settings: { ...org.settings, billing: next }, status: org.status === 'suspended' || org.status === 'trial' ? 'active' : org.status }).where(eq(organizations.id, org.id));
    await db.insert(auditLogs).values({ orgId: org.id, userId: admin.id, action: 'admin.payment_recorded', entityType: 'organization', entityId: org.id, meta: { amount: p.amount, currency: p.currency, months: p.months } });
    return { paidUntil };
  });
}

/** Support: switch into a hotel's dashboard. */
export async function enterHotel(orgId: string): Promise<ActionResult> {
  return adminRun(async () => {
    const id = z.uuid().parse(orgId);
    const [o] = await db.select({ id: organizations.id }).from(organizations).where(and(eq(organizations.id, id))).limit(1);
    if (!o) fail('notFound');
    (await cookies()).set(ACTIVE_ORG_COOKIE, o.id, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 });
    return null;
  });
}
