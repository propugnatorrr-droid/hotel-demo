import { index, jsonb, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { bookings } from './bookings';
import { createdAt, id, updatedAt } from './columns';
import { integrationProvider } from './enums';
import { orgRef } from './tenancy';

/** Every push to / pull from a channel. Pull rows are keyed by the external revision id (idempotency). */
export const channelEvents = pgTable(
  'channel_events',
  {
    id: id(),
    orgId: orgRef(),
    provider: integrationProvider().notNull(),
    direction: text().$type<'push' | 'pull'>().notNull(),
    kind: text().notNull(),
    status: text().$type<'ok' | 'warning' | 'error'>().notNull(),
    externalId: text(),
    bookingId: uuid().references(() => bookings.id, { onDelete: 'set null' }),
    summary: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    error: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('channel_events_org_provider_ext_uq').on(t.orgId, t.provider, t.externalId),
    index('channel_events_org_created_idx').on(t.orgId, t.createdAt),
  ],
);
