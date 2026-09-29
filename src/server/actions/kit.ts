import 'server-only';
import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { requireOrg } from '@/lib/auth/session';
import type { ModuleKey, Role } from '@/lib/auth/types';

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };
export type Ctx = Awaited<ReturnType<typeof requireOrg>>;
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export const FRONT: readonly Role[] = ['owner', 'manager', 'receptionist'];
export const MANAGERS: readonly Role[] = ['owner', 'manager'];
export const round2 = (n: number) => Math.round(n * 100) / 100;

export class ActionError extends Error {}
export function fail(code: string): never {
  throw new ActionError(code);
}

/** Auth + module + role gate. Every mutation starts here. */
export async function gate(roles: readonly Role[], module?: ModuleKey): Promise<Ctx> {
  const ctx = await requireOrg();
  if (module && !ctx.modules.has(module)) fail('module');
  if (!roles.includes(ctx.role) && !ctx.profile.isSuperAdmin) fail('forbidden');
  return ctx;
}

export const isManager = (ctx: Ctx) => MANAGERS.includes(ctx.role) || ctx.profile.isSuperAdmin;

export function pgCode(e: unknown) {
  const x = e as { code?: string; cause?: { code?: string } };
  return x?.code ?? x?.cause?.code;
}

export async function run<T>(fn: () => Promise<T>, mutate = true): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    if (mutate) revalidatePath('/[locale]/app', 'layout');
    return { ok: true, data };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ActionError) return { ok: false, error: error.message };
    if (error instanceof z.ZodError) return { ok: false, error: 'invalid' };
    const code = pgCode(error);
    if (code === '23P01') return { ok: false, error: 'roomTaken' };
    if (code === '23505') return { ok: false, error: 'duplicate' };
    if (code === '23514' || code === '22P02') {
      console.error('[action:invalid]', code, error);
      return { ok: false, error: 'invalid' };
    }
    console.error('[action]', error);
    return { ok: false, error: 'unknown' };
  }
}

export async function audit(
  tx: Tx | typeof db,
  ctx: Ctx,
  action: string,
  entityType: string,
  entityId?: string | null,
  meta: Record<string, unknown> = {},
) {
  await tx.insert(auditLogs).values({ orgId: ctx.org.id, userId: ctx.user.id, action, entityType, entityId: entityId ?? null, meta });
}
