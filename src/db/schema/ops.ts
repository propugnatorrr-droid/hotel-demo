import { boolean, date, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id } from './columns';
import { alertSeverity, housekeepingType, integrationProvider, priority, taskStatus } from './enums';
import { roomTypes, rooms } from './rooms';
import { orgRef, profiles } from './tenancy';

export const housekeepingTasks = pgTable(
  'housekeeping_tasks',
  {
    id: id(),
    orgId: orgRef(),
    roomId: uuid()
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    assignedTo: uuid().references(() => profiles.id, { onDelete: 'set null' }),
    type: housekeepingType().notNull(),
    status: taskStatus().notNull().default('open'),
    priority: priority().notNull().default('normal'),
    dueDate: date({ mode: 'string' }).notNull(),
    notes: text(),
    startedAt: timestamp({ withTimezone: true }),
    completedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('housekeeping_org_due_idx').on(t.orgId, t.dueDate)],
);

export const maintenanceTickets = pgTable(
  'maintenance_tickets',
  {
    id: id(),
    orgId: orgRef(),
    roomId: uuid().references(() => rooms.id, { onDelete: 'set null' }),
    title: text().notNull(),
    description: text(),
    status: taskStatus().notNull().default('open'),
    priority: priority().notNull().default('normal'),
    blocksRoom: boolean().notNull().default(false),
    reportedBy: uuid().references(() => profiles.id, { onDelete: 'set null' }),
    assignedTo: uuid().references(() => profiles.id, { onDelete: 'set null' }),
    resolvedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('maintenance_org_status_idx').on(t.orgId, t.status)],
);

export const alerts = pgTable(
  'alerts',
  {
    id: id(),
    orgId: orgRef(),
    type: text().notNull(),
    severity: alertSeverity().notNull().default('info'),
    title: text().notNull(),
    body: text(),
    entityType: text(),
    entityId: uuid(),
    data: jsonb().$type<Record<string, unknown>>(),
    isRead: boolean().notNull().default(false),
    resolvedAt: timestamp({ withTimezone: true }),
    resolvedBy: uuid().references(() => profiles.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('alerts_org_created_idx').on(t.orgId, t.createdAt)],
);

export const channelMappings = pgTable(
  'channel_mappings',
  {
    id: id(),
    orgId: orgRef(),
    provider: integrationProvider().notNull(),
    channel: text().notNull(),
    roomTypeId: uuid()
      .notNull()
      .references(() => roomTypes.id, { onDelete: 'cascade' }),
    externalRoomId: text(),
    externalRatePlanId: text(),
    icalImportUrl: text(),
    icalExportToken: text(),
    isActive: boolean().notNull().default(true),
    lastSyncAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('channel_mappings_org_channel_type_uq').on(t.orgId, t.channel, t.roomTypeId)],
);

export const ownerReports = pgTable(
  'owner_reports',
  {
    id: id(),
    orgId: orgRef(),
    reportDate: date({ mode: 'string' }).notNull(),
    kind: text().notNull().default('morning'),
    content: jsonb().$type<{ headline: string; story: string; metrics: Record<string, number>; actions: string[] }>().notNull(),
    sentVia: text(),
    sentAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('owner_reports_org_date_kind_uq').on(t.orgId, t.reportDate, t.kind)],
);
