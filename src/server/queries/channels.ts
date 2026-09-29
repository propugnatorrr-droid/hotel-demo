import 'server-only';

import { and, asc, desc, eq, gte, notInArray, sql } from 'drizzle-orm';
import { OTA_SOURCES } from '@/config/channels';
import { db } from '@/db';
import { bookings, channelEvents, channelMappings, integrations, roomTypes } from '@/db/schema';
import type { OrgContext } from '@/lib/auth/session';
import { addDays, todayIn } from '@/lib/dates';
import { resolveChannelMode } from '@/server/integrations/channel';

export async function getChannelsOverview(ctx: OrgContext) {
  const orgId = ctx.org.id;
  await db.insert(integrations).values({ orgId, provider: 'channex', mode: 'mock' }).onConflictDoNothing();
  const since = addDays(todayIn(ctx.org.timezone), -90);

  const [[integ], events, types, maps, mix] = await Promise.all([
    db.select().from(integrations).where(and(eq(integrations.orgId, orgId), eq(integrations.provider, 'channex'))).limit(1),
    db
      .select({
        id: channelEvents.id, direction: channelEvents.direction, kind: channelEvents.kind, status: channelEvents.status,
        summary: channelEvents.summary, error: channelEvents.error, bookingId: channelEvents.bookingId, createdAt: channelEvents.createdAt,
      })
      .from(channelEvents)
      .where(eq(channelEvents.orgId, orgId))
      .orderBy(desc(channelEvents.createdAt))
      .limit(40),
    db
      .select({ id: roomTypes.id, code: roomTypes.code, name: roomTypes.name })
      .from(roomTypes)
      .where(and(eq(roomTypes.orgId, orgId), eq(roomTypes.isActive, true)))
      .orderBy(asc(roomTypes.sortOrder)),
    db
      .select({
        channel: channelMappings.channel, roomTypeId: channelMappings.roomTypeId,
        externalRoomId: channelMappings.externalRoomId, externalRatePlanId: channelMappings.externalRatePlanId,
      })
      .from(channelMappings)
      .where(and(eq(channelMappings.orgId, orgId), eq(channelMappings.isActive, true))),
    db
      .select({
        source: bookings.source,
        count: sql<number>`count(*)`.mapWith(Number),
        revenue: sql<number>`coalesce(sum(${bookings.totalAmount}), 0)`.mapWith(Number),
        commission: sql<number>`coalesce(sum(${bookings.commissionAmount}), 0)`.mapWith(Number),
      })
      .from(bookings)
      .where(and(eq(bookings.orgId, orgId), notInArray(bookings.status, ['cancelled', 'no_show']), gte(bookings.checkIn, since)))
      .groupBy(bookings.source),
  ]);

  const ota = mix.filter((m) => (OTA_SOURCES as readonly string[]).includes(m.source));
  const otaCommission = ota.reduce((s, m) => s + m.commission, 0);
  const totalRevenue = mix.reduce((s, m) => s + m.revenue, 0);
  const otaRevenue = ota.reduce((s, m) => s + m.revenue, 0);
  const mode = resolveChannelMode(integ ?? null);

  return {
    orgId,
    mode,
    propertyId: integ?.externalAccountId ?? '',
    lastSyncAt: integ?.lastSyncAt?.toISOString() ?? null,
    lastError: integ?.lastError ?? null,
    hasKey: Boolean(process.env.CHANNEX_API_KEY),
    webhookReady: Boolean(process.env.CHANNEX_WEBHOOK_SECRET),
    events: events.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
    types,
    maps,
    mix: mix.sort((a, b) => b.revenue - a.revenue),
    insight: {
      otaCommission: Math.round(otaCommission),
      otaShare: totalRevenue ? Math.round((otaRevenue / totalRevenue) * 100) : 0,
      savings: Math.round(otaCommission * 0.2),
    },
  };
}

export type ChannelsOverview = Awaited<ReturnType<typeof getChannelsOverview>>;
