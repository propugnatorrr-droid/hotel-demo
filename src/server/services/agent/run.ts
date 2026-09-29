import 'server-only';
import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import type { OrgContext } from '@/lib/auth/session';
import { toolsFor, type AgentToolDef } from './tools';

export function findTool(ctx: OrgContext, name: string): AgentToolDef | undefined {
  return toolsFor(ctx).find((t) => t.name === name);
}

/** Runs one agent tool with the caller's own permissions (every underlying server action re-checks role + module). */
export async function executeTool(ctx: OrgContext, name: string, args: Record<string, unknown>, via: 'auto' | 'human') {
  const def = findTool(ctx, name);
  if (!def) return { ok: false as const, error: 'Tool not available for this role.' };
  try {
    const result = await def.run(ctx, args);
    if (def.kind === 'write') {
      await db.insert(auditLogs).values({ orgId: ctx.org.id, userId: ctx.user.id, action: `agent.${name}`, entityType: 'agent', meta: { via, args: JSON.stringify(args).length > 3000 ? { truncated: true } : args } }).catch(() => undefined);
    }
    return { ok: true as const, result };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : 'failed' };
  }
}
