import { z } from 'zod';
import { aiConfigured } from '@/lib/ai/openrouter';
import { takeAiBudget } from '@/lib/ai/budget';
import { requireOrg } from '@/lib/auth/session';
import { askHotel } from '@/server/services/owner-ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const body = z.object({ message: z.string().trim().min(2).max(600), locale: z.enum(['sq', 'en']).default('sq') });

/** "Pyet hotelin": owner/manager/accountant only, because answers include revenue and guest data. */
export async function POST(request: Request) {
  const ctx = await requireOrg();
  if (!['owner', 'manager', 'accountant'].includes(ctx.role) && !ctx.profile.isSuperAdmin) return Response.json({ error: 'forbidden' }, { status: 403 });
  if (!ctx.modules.has('owner_ai')) return Response.json({ error: 'module' }, { status: 403 });
  if (!aiConfigured()) return Response.json({ error: 'ai_off' }, { status: 503 });
  const p = body.safeParse(await request.json().catch(() => null));
  if (!p.success) return Response.json({ error: 'invalid' }, { status: 400 });
  if (!(await takeAiBudget(ctx.org.id, ctx.user.id, 'owner', 60))) return Response.json({ error: 'limit' }, { status: 429 });

  try {
    return Response.json(await askHotel(ctx, p.data.message, p.data.locale));
  } catch (e) {
    console.error('[owner-ai]', e);
    return Response.json({ error: 'failed' }, { status: 502 });
  }
}
