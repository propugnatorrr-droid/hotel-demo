import { z } from 'zod';
import { requireOrg } from '@/lib/auth/session';
import { executeTool, findTool } from '@/server/services/agent/run';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const body = z.object({ tool: z.string().max(60), args: z.record(z.string(), z.unknown()), locale: z.enum(['sq', 'en']).default('sq') });

/** Human pressed Confirm on a proposal: run that write tool with the user's own session and permissions. */
export async function POST(request: Request) {
  const ctx = await requireOrg();
  const p = body.safeParse(await request.json().catch(() => null));
  if (!p.success) return Response.json({ ok: false, error: 'invalid' }, { status: 400 });
  const def = findTool(ctx, p.data.tool);
  if (!def || def.kind !== 'write') return Response.json({ ok: false, error: 'forbidden' }, { status: 403 });
  const r = await executeTool(ctx, p.data.tool, p.data.args, 'human');
  return Response.json(r.ok ? { ok: true, summary: def.summarize?.(p.data.args, p.data.locale) ?? def.label[p.data.locale] } : { ok: false, error: r.error });
}
