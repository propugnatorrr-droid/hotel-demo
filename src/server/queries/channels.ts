import 'server-only';
import { and, asc, desc, eq, like } from 'drizzle-orm';
import { db } from '@/db';
import { auditLogs, channelMappings, integrations, rooms, roomTypes } from '@/db/schema';
import type { OrgContext } from '@/lib/auth/session';
import { env } from '@/lib/env';
import { signRoom } from '@/lib/integrations/ical';
import { envReady } from '@/lib/integrations/registry';
import { localized } from '@/lib/utils';

export const ALL_PROVIDERS = ['channex', 'ical', 'meta_whatsapp', 'meta_instagram', 'meta_messenger', 'paysera', 'easypos', 'fature_al', 'vapi', 'resend', 'ai', 'telegram'] as const;

export async function getChannels(ctx: OrgContext, locale: string) {
  const orgId = ctx.org.id;
  const [ints, maps, types, roomRows, log] = await Promise.all([
    db.select().from(integrations).where(eq(integrations.orgId, orgId)),
    db.select().from(channelMappings).where(eq(channelMappings.orgId, orgId)).orderBy(asc(channelMappings.channel)),
    db.select({ id: roomTypes.id, code: roomTypes.code, name: roomTypes.name }).from(roomTypes).where(and(eq(roomTypes.orgId, orgId), eq(roomTypes.isActive, true))).orderBy(asc(roomTypes.sortOrder)),
    db.select({ id: rooms.id, number: rooms.number, roomTypeId: rooms.roomTypeId }).from(rooms).where(and(eq(rooms.orgId, orgId), eq(rooms.isActive, true))).orderBy(asc(rooms.number)),
    db.select({ id: auditLogs.id, action: auditLogs.action, meta: auditLogs.meta, createdAt: auditLogs.createdAt }).from(auditLogs).where(and(eq(auditLogs.orgId, orgId), like(auditLogs.action, 'channel.%'))).orderBy(desc(auditLogs.createdAt)).limit(12),
  ]);

  const byProvider = new Map(ints.map((i) => [i.provider, i]));
  return {
    integrations: ALL_PROVIDERS.map((p) => {
      const i = byProvider.get(p);
      return {
        provider: p,
        mode: i?.mode ?? ('mock' as const),
        enabled: i?.isEnabled ?? true,
        lastSyncAt: i?.lastSyncAt?.toISOString() ?? null,
        lastError: i?.lastError ?? null,
        envReady: envReady(p),
      };
    }),
    types: types.map((t) => ({ id: t.id, code: t.code, name: localized(t.name, locale) })),
    mappings: maps.map((m) => ({
      id: m.id,
      channel: m.channel,
      roomTypeId: m.roomTypeId,
      icalImportUrl: m.icalImportUrl,
      externalRoomId: m.externalRoomId,
      externalRatePlanId: m.externalRatePlanId,
      lastSyncAt: m.lastSyncAt?.toISOString() ?? null,
    })),
    exports: roomRows.map((r) => ({ id: r.id, number: r.number, typeId: r.roomTypeId, url: `${env.NEXT_PUBLIC_APP_URL}/api/ical/${r.id}.${signRoom(r.id)}.ics` })),
    log: log.map((l) => ({ id: l.id, action: l.action, meta: l.meta, createdAt: l.createdAt.toISOString() })),
  };
}

export type ChannelsData = Awaited<ReturnType<typeof getChannels>>;
