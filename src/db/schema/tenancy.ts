import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, id, updatedAt } from './columns';
import { currency, integrationMode, integrationProvider, memberRole, moduleKey, orgStatus, planTier } from './enums';

export const organizations = pgTable('organizations', {
  id: id(),
  name: text().notNull(),
  slug: text().notNull().unique(),
  legalName: text(),
  nipt: text(),
  country: text().notNull().default('AL'),
  city: text(),
  address: text(),
  phone: text(),
  email: text(),
  website: text(),
  latitude: text(),
  longitude: text(),
  timezone: text().notNull().default('Europe/Tirane'),
  defaultLocale: text().notNull().default('sq'),
  currency: currency().notNull().default('EUR'),
  plan: planTier().notNull().default('basic'),
  status: orgStatus().notNull().default('trial'),
  isDemo: boolean().notNull().default(false),
  brandColor: text(),
  logoUrl: text(),
  coverImageUrl: text(),
  aiPersona: jsonb().$type<{ name: string; tone: string; instructions?: string }>(),
  settings: jsonb().$type<Record<string, unknown>>().notNull().default({}),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const orgRef = () =>
  uuid()
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' });

export const profiles = pgTable('profiles', {
  id: uuid().primaryKey(),
  email: text().notNull(),
  fullName: text(),
  phone: text(),
  avatarUrl: text(),
  locale: text().notNull().default('sq'),
  isSuperAdmin: boolean().notNull().default(false),
  simpleMode: boolean().notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const memberships = pgTable(
  'memberships',
  {
    id: id(),
    orgId: orgRef(),
    userId: uuid()
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    role: memberRole().notNull(),
    isActive: boolean().notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('memberships_org_user_uq').on(t.orgId, t.userId),
    index('memberships_user_idx').on(t.userId),
  ],
);

export const orgModules = pgTable(
  'org_modules',
  {
    orgId: orgRef(),
    module: moduleKey().notNull(),
    enabled: boolean().notNull().default(true),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.module] })],
);

export const integrations = pgTable(
  'integrations',
  {
    id: id(),
    orgId: orgRef(),
    provider: integrationProvider().notNull(),
    mode: integrationMode().notNull().default('mock'),
    isEnabled: boolean().notNull().default(true),
    config: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    externalAccountId: text(),
    lastSyncAt: timestamp({ withTimezone: true }),
    lastError: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('integrations_org_provider_uq').on(t.orgId, t.provider)],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: id(),
    orgId: orgRef(),
    userId: uuid().references(() => profiles.id, { onDelete: 'set null' }),
    action: text().notNull(),
    entityType: text().notNull(),
    entityId: uuid(),
    meta: jsonb().$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
  },
  (t) => [index('audit_logs_org_created_idx').on(t.orgId, t.createdAt)],
);
