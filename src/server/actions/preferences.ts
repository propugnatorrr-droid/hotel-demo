'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { db } from '@/db';
import { profiles } from '@/db/schema';
import { ACTIVE_ORG_COOKIE, requireOrg, requireUser } from '@/lib/auth/session';

export async function setSimpleMode(enabled: boolean) {
  const { user } = await requireUser();
  await db
    .update(profiles)
    .set({ simpleMode: z.boolean().parse(enabled) })
    .where(eq(profiles.id, user.id));
  revalidatePath('/', 'layout');
}

export async function setActiveOrg(orgId: string) {
  const ctx = await requireOrg();
  const id = z.uuid().parse(orgId);
  if (!ctx.orgs.some((o) => o.id === id)) throw new Error('Forbidden');

  (await cookies()).set(ACTIVE_ORG_COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath('/', 'layout');
}
