import { sql } from 'drizzle-orm';
import { boolean, date, index, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { createdAt, id, updatedAt } from './columns';
import { orgRef } from './tenancy';

export const guests = pgTable(
  'guests',
  {
    id: id(),
    orgId: orgRef(),
    firstName: text().notNull(),
    lastName: text().notNull(),
    email: text(),
    phone: text(),
    nationality: text(),
    language: text().default('sq'),
    documentType: text(),
    documentNumber: text(),
    dateOfBirth: date({ mode: 'string' }),
    address: text(),
    city: text(),
    country: text(),
    isVip: boolean().notNull().default(false),
    tags: text().array().notNull().default(sql`'{}'::text[]`),
    preferences: jsonb().$type<Record<string, unknown>>().notNull().default({}),
    notes: text(),
    marketingConsent: boolean().notNull().default(false),
    documentImagePath: text(),
    documentDeleteAfter: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('guests_org_name_idx').on(t.orgId, t.lastName, t.firstName),
    index('guests_org_phone_idx').on(t.orgId, t.phone),
    index('guests_org_email_idx').on(t.orgId, t.email),
  ],
);
