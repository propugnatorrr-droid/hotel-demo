'use server';

import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { channelMappings, integrations, roomTypes } from '@/db/schema';
import { assertPublicFeedUrl } from '@/lib/integrations/ical';
import { envReady } from '@/lib/integrations/registry';
import { pushChannel, syncIcalMapping, type SyncResult } from '@/server/services/channel-sync';
import { audit, fail, gate, MANAGERS, run, type ActionResult } from './kit';

const providers = ['channex', 'ical', 'meta_whatsapp', 'meta_instagram', 'meta_messenger', 'paysera', 'easypos', 'fature_al', 'vapi', 'resend', 'ai', 'telegram'] as const;

export async function setIntegration(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const ctx = await gate(MANAGERS);
    const p = z.object({ provider: z.enum(providers), mode: z.enum(['mock', 'sandbox', 'live']), enabled: z.boolean() }).parse(input);
    if (p.mode !== 'mock' && !envReady(p.provider)) fail('envMissing');
    if (p.mode === 'live' && ctx.org.isDemo) fail('demoLive');
    await db
      .insert(integrations)
      .values({ orgId: ctx.org.id, provider: p.provider, mode: p.mode, isEnabled: p.enabled })
      .onConflictDoUpdate({ target: [integrations.orgId, integrations.provider], set: { mode: p.mode, isEnabled: p.enabled } });
    await audit(db, ctx, 'integration.updated', 'integration', null, p);
    return null;
  });
}

const CHANNELS = ['booking_com', 'airbnb', 'expedia', 'agoda'] as const;

export async function saveMapping(input: unknown): Promise<ActionResult> {
  return run(async () => {
    const ctx = await gate(MANAGERS, 'channel_manager');
    const p = z
      .object({
        roomTypeId: z.uuid(),
        channel: z.enum(CHANNELS),
        icalImportUrl: z.string().trim().max(600).optional(),
        externalRoomId: z.string().trim().max(120).optional(),
        externalRatePlanId: z.string().trim().max(120).optional(),
      })
      .parse(input);
    const [type] = await db.select({ id: roomTypes.id }).from(roomTypes).where(and(eq(roomTypes.orgId, ctx.org.id), eq(roomTypes.id, p.roomTypeId))).limit(1);
    if (!type) fail('type');
    if (p.icalImportUrl) {
      try {
        assertPublicFeedUrl(p.icalImportUrl);
      } catch {
        fail('badUrl');
      }
    }
    await db
      .insert(channelMappings)
      .values({
        orgId: ctx.org.id,
        provider: 'channex',
        channel: p.channel,
        roomTypeId: p.roomTypeId,
        icalImportUrl: p.icalImportUrl || null,
        externalRoomId: p.externalRoomId || null,
        externalRatePlanId: p.externalRatePlanId || null,
      })
      .onConflictDoUpdate({
        target: [channelMappings.orgId, channelMappings.channel, channelMappings.roomTypeId],
        set: { icalImportUrl: p.icalImportUrl || null, externalRoomId: p.externalRoomId || null, externalRatePlanId: p.externalRatePlanId || null },
      });
    await audit(db, ctx, 'channel.mapping_saved', 'channel_mapping', null, { channel: p.channel, roomTypeId: p.roomTypeId });
    return null;
  });
}

export async function syncMapping(mappingId: string): Promise<ActionResult<SyncResult>> {
  return run(async () => {
    const ctx = await gate(MANAGERS, 'channel_manager');
    const id = z.uuid().parse(mappingId);
    const r = await syncIcalMapping(ctx.org.id, id, ctx.org.timezone, ctx.org.currency);
    if (r.error) fail(r.error === 'no_feed' ? 'noFeed' : 'syncFailed');
    return r;
  });
}

export async function syncAllMappings(): Promise<ActionResult<SyncResult>> {
  return run(async () => {
    const ctx = await gate(MANAGERS, 'channel_manager');
    const rows = await db.select().from(channelMappings).where(eq(channelMappings.orgId, ctx.org.id));
    const total: SyncResult = { created: 0, updated: 0, cancelled: 0, conflicts: 0 };
    for (const m of rows.filter((x) => x.icalImportUrl && x.isActive)) {
      const r = await syncIcalMapping(ctx.org.id, m.id, ctx.org.timezone, ctx.org.currency);
      total.created += r.created;
      total.updated += r.updated;
      total.cancelled += r.cancelled;
      total.conflicts += r.conflicts;
      if (r.error) total.error = r.error;
    }
    return total;
  });
}

export async function pushAvailability(): Promise<ActionResult<{ mode: string; rows: number; pushed: boolean }>> {
  return run(async () => {
    const ctx = await gate(MANAGERS, 'channel_manager');
    const r = await pushChannel(ctx.org.id);
    if (r.error) fail(r.error === 'not_mapped' ? 'notMapped' : 'pushFailed');
    return r;
  });
}
