import { sql } from 'drizzle-orm';
import { boolean, date, index, integer, jsonb, pgTable, primaryKey, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id, money, updatedAt, type Localized } from './columns';
import { roomStatus } from './enums';
import { orgRef } from './tenancy';

export const roomTypes = pgTable(
  'room_types',
  {
    id: id(),
    orgId: orgRef(),
    code: text().notNull(),
    name: jsonb().$type<Localized>().notNull(),
    description: jsonb().$type<Localized>(),
    baseOccupancy: integer().notNull().default(2),
    maxOccupancy: integer().notNull().default(2),
    basePrice: money().notNull(),
    sizeSqm: integer(),
    bedType: text(),
    view: text(),
    amenities: text().array().notNull().default(sql`'{}'::text[]`),
    images: text().array().notNull().default(sql`'{}'::text[]`),
    sortOrder: integer().notNull().default(0),
    isActive: boolean().notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('room_types_org_code_uq').on(t.orgId, t.code)],
);

export const rooms = pgTable(
  'rooms',
  {
    id: id(),
    orgId: orgRef(),
    roomTypeId: uuid()
      .notNull()
      .references(() => roomTypes.id, { onDelete: 'restrict' }),
    number: text().notNull(),
    floor: integer().notNull().default(0),
    building: text(),
    status: roomStatus().notNull().default('clean'),
    isActive: boolean().notNull().default(true),
    layout: jsonb().$type<{ x: number; y: number; w: number; h: number }>(),
    notes: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('rooms_org_number_uq').on(t.orgId, t.number),
    index('rooms_org_type_idx').on(t.orgId, t.roomTypeId),
  ],
);

export const dailyRates = pgTable(
  'daily_rates',
  {
    orgId: orgRef(),
    roomTypeId: uuid()
      .notNull()
      .references(() => roomTypes.id, { onDelete: 'cascade' }),
    date: date({ mode: 'string' }).notNull(),
    price: money().notNull(),
    minStay: integer().notNull().default(1),
    closed: boolean().notNull().default(false),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.roomTypeId, t.date] }), index('daily_rates_org_date_idx').on(t.orgId, t.date)],
);
