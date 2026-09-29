import 'server-only';
import { and, asc, eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { cache } from 'react';
import { db } from '@/db';
import { memberships, organizations, orgModules, profiles } from '@/db/schema';
import { isSupabaseConfigured } from '@/lib/env';
import { localePath } from '@/lib/paths';
import { createClient } from '@/lib/supabase/server';
import type { ModuleKey, Role } from './types';

export const ACTIVE_ORG_COOKIE = 'active_org';

export type Organization = typeof organizations.$inferSelect;
export type Profile = typeof profiles.$inferSelect;

export type OrgSummary = { id: string; name: string; slug: string; isDemo: boolean; role: Role };

export type OrgContext = {
  user: { id: string; email: string };
  profile: Profile;
  org: Organization;
  role: Role;
  orgs: OrgSummary[];
  modules: Set<ModuleKey>;
};

async function redirectToLogin(query = ''): Promise<never> {
  const locale = await getLocale();
  redirect(localePath(locale, `/login${query}`));
}

export const getSessionUser = cache(async () => {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const requireUser = cache(async () => {
  if (!isSupabaseConfigured) return redirectToLogin('?setup=1');
  const user = await getSessionUser();
  if (!user) return redirectToLogin();

  let [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);

  if (!profile) {
    // Safety net if the auth trigger (supabase/sql/01) was not run
    await db
      .insert(profiles)
      .values({
        id: user.id,
        email: user.email ?? '',
        fullName: (user.user_metadata?.full_name as string | undefined) ?? null,
      })
      .onConflictDoNothing();
    [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id)).limit(1);
  }

  if (!profile) throw new Error('Profile could not be created');
  return { user, profile };
});

export const requireOrg = cache(async (): Promise<OrgContext> => {
  const { user, profile } = await requireUser();

  let list: { org: Organization; role: Role }[] = await db
    .select({ org: organizations, role: memberships.role })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.orgId, organizations.id))
    .where(and(eq(memberships.userId, user.id), eq(memberships.isActive, true)))
    .orderBy(asc(organizations.name));

  if (profile.isSuperAdmin) {
    // Super admins can enter every hotel (support / impersonation); keep their real role where they are members.
    const all = await db.select().from(organizations).orderBy(asc(organizations.name));
    const own = new Map(list.map((r) => [r.org.id, r.role]));
    list = all.map((org) => ({ org, role: own.get(org.id) ?? ('owner' as const) }));
  }

  if (list.length === 0) return redirectToLogin('?error=noMembership');

  const wanted = (await cookies()).get(ACTIVE_ORG_COOKIE)?.value;
  const active = list.find((r) => r.org.id === wanted) ?? list[0]!;

  const mods = await db
    .select({ module: orgModules.module, enabled: orgModules.enabled })
    .from(orgModules)
    .where(eq(orgModules.orgId, active.org.id));

  return {
    user: { id: user.id, email: user.email ?? profile.email },
    profile,
    org: active.org,
    role: active.role,
    orgs: list.map(({ org, role }) => ({ id: org.id, name: org.name, slug: org.slug, isDemo: org.isDemo, role })),
    modules: new Set(mods.filter((m) => m.enabled).map((m) => m.module)),
  };
});

export function hasModule(ctx: OrgContext, key: ModuleKey) {
  return ctx.modules.has(key);
}

export async function requireModule(key: ModuleKey) {
  const ctx = await requireOrg();
  if (!ctx.modules.has(key)) notFound();
  return ctx;
}

export async function requireRole(roles: readonly Role[]) {
  const ctx = await requireOrg();
  if (!roles.includes(ctx.role) && !ctx.profile.isSuperAdmin) notFound();
  return ctx;
}
