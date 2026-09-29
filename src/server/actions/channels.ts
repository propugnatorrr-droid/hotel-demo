'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { z } from 'zod';
import { db } from '@/db';
import { auditLogs, channelMappings, integrations, roomTypes } from '@/db/schema';
import { requireOrg } from '@/lib/auth/session';
import { ChannelError, resolveChannelMode } from '@/server/integrations/channel';
import { pullChannex, pushAri, simulateOtaBooking } from '@/server/services/channel-sync';
import type { ActionResult } from './bookings';

class ActionError extends Error {}
function fail(code: string): never {
  throw new ActionError(code);
}

async function manager() {
  const ctx = await requireOrg();
  if (!ctx.modules.has('channel_manager')) fail('module');
  if (!['owner', 'manager'].includes(ctx.role) && !ctx.profile.isSuperAdmin) fail('forbidden');
  return ctx;
}

async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    revalidatePath('/[locale]/app', 'layout');
    return { ok: true, data };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ActionError || error instanceof ChannelError) return { ok: false, error: error.message };
    if (error instanceof z.ZodError) return { ok: false, error: 'invalid' };
    if (error instanceof Error && ['soldOut', 'type', 'unmapped'].includes(error.message)) return { ok: false, error: error.message };
    console.error('[channels]', error);
    return { ok: false, error: 'unknown' };
  }
}

export async function syncChannels(): Promise<ActionResult<{ pulled: number }>> {
  return run(async () => {
    const ctx = await manager();
    const push = await pushAri(ctx.org.id, { availability: true, restrictions: true, force: true });
    if (push?.availability === 'error' || push?.restrictions === 'error') fail('pushFailed');
    const [integ] = await db
      .select()
      .from(integrations)
      .where(and(eq(integrations.orgId, ctx.org.id), eq(integrations.provider, 'channex')))
      .limit(1);
    const pulled = resolveChannelMode(integ).effective === 'channex' ? (await pullChannex()).applied : 0;
    return { pulled };
  });
}

const simSchema = z.object({ channel: z.enum(['booking_com', 'airbnb', 'expedia']) });

export async function simulateBooking(input: unknown): Promise<ActionResult<{ bookingId: string | null }>> {
  return run(async () => {
    const ctx = await manager();
    const p = simSchema.parse(input);
    return { bookingId: await simulateOtaBooking(ctx.org.id, p.channel) };
  });
}

const connSchema = z.object({ mode: z.enum(['mock', 'sandbox', 'live']), propertyId: z.string().trim().max(64) });

export async function saveChannelConnection(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const ctx = await manager();
    const p = connSchema.parse(input);
    if (p.mode !== 'mock') {
      if (!process.env.CHANNEX_API_KEY) fail('noKey');
      if (!z.uuid().safeParse(p.propertyId).success) fail('propertyId');
    }
    await db
      .update(integrations)
      .set({ mode: p.mode, externalAccountId: p.propertyId || null, isEnabled: true, lastError: null, config: {} }) // reset hashes → full push
      .where(and(eq(integrations.orgId, ctx.org.id), eq(integrations.provider, 'channex')));
    await db.insert(auditLogs).values({
      orgId: ctx.org.id, userId: ctx.user.id, action: 'channels.connection_saved', entityType: 'integration', meta: { mode: p.mode },
    });
    return null;
  });
}

const mapSchema = z.object({
  roomTypeId: z.uuid(),
  externalRoomId: z.string().trim().max(64),
  externalRatePlanId: z.string().trim().max(64),
});

export async function saveChannelMapping(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const ctx = await manager();
    const p = mapSchema.parse(input);
    const [type] = await db
      .select({ id: roomTypes.id })
      .from(roomTypes)
      .where(and(eq(roomTypes.orgId, ctx.org.id), eq(roomTypes.id, p.roomTypeId)))
      .limit(1);
    if (!type) fail('type');
    await db
      .insert(channelMappings)
      .values({
        orgId: ctx.org.id, provider: 'channex', channel: 'channex', roomTypeId: p.roomTypeId,
        externalRoomId: p.externalRoomId || null, externalRatePlanId: p.externalRatePlanId || null,
      })
      .onConflictDoUpdate({
        target: [channelMappings.orgId, channelMappings.channel, channelMappings.roomTypeId],
        set: { externalRoomId: p.externalRoomId || null, externalRatePlanId: p.externalRatePlanId || null, isActive: true },
      });
    return null;
  });
}
