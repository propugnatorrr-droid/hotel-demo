import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id, money, qty, rate, type Localized } from './columns';
import { bookings, folios } from './bookings';
import { appointmentStatus, outletType, paymentMethod, posOrderStatus } from './enums';
import { guests } from './guests';
import { orgRef, profiles } from './tenancy';

export const outlets = pgTable('outlets', {
  id: id(),
  orgId: orgRef(),
  type: outletType().notNull(),
  name: jsonb().$type<Localized>().notNull(),
  openingHours: text(),
  isActive: boolean().notNull().default(true),
  sortOrder: integer().notNull().default(0),
  createdAt: createdAt(),
});

export const productCategories = pgTable('product_categories', {
  id: id(),
  orgId: orgRef(),
  outletId: uuid()
    .notNull()
    .references(() => outlets.id, { onDelete: 'cascade' }),
  name: jsonb().$type<Localized>().notNull(),
  sortOrder: integer().notNull().default(0),
});

export const products = pgTable(
  'products',
  {
    id: id(),
    orgId: orgRef(),
    outletId: uuid()
      .notNull()
      .references(() => outlets.id, { onDelete: 'cascade' }),
    categoryId: uuid().references(() => productCategories.id, { onDelete: 'set null' }),
    name: jsonb().$type<Localized>().notNull(),
    description: jsonb().$type<Localized>(),
    price: money().notNull(),
    cost: money(),
    vatRate: rate().notNull().default(20),
    sku: text(),
    imageUrl: text(),
    trackStock: boolean().notNull().default(false),
    stockQty: qty().notNull().default(0),
    lowStockThreshold: qty(),
    isActive: boolean().notNull().default(true),
    sortOrder: integer().notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index('products_org_outlet_idx').on(t.orgId, t.outletId)],
);

export const posTables = pgTable('pos_tables', {
  id: id(),
  orgId: orgRef(),
  outletId: uuid()
    .notNull()
    .references(() => outlets.id, { onDelete: 'cascade' }),
  label: text().notNull(),
  seats: integer().notNull().default(4),
  layout: jsonb().$type<{ x: number; y: number; w: number; h: number; shape: 'round' | 'square' }>(),
});

export const posOrders = pgTable(
  'pos_orders',
  {
    id: id(),
    orgId: orgRef(),
    outletId: uuid()
      .notNull()
      .references(() => outlets.id, { onDelete: 'restrict' }),
    tableId: uuid().references(() => posTables.id, { onDelete: 'set null' }),
    bookingId: uuid().references(() => bookings.id, { onDelete: 'set null' }),
    folioId: uuid().references(() => folios.id, { onDelete: 'set null' }),
    status: posOrderStatus().notNull().default('open'),
    subtotal: money().notNull().default(0),
    discount: money().notNull().default(0),
    total: money().notNull().default(0),
    paymentMethod: paymentMethod(),
    covers: integer(),
    notes: text(),
    openedBy: uuid().references(() => profiles.id, { onDelete: 'set null' }),
    paidAt: timestamp({ withTimezone: true }),
    voidedAt: timestamp({ withTimezone: true }),
    voidReason: text(),
    createdAt: createdAt(),
  },
  (t) => [index('pos_orders_org_outlet_created_idx').on(t.orgId, t.outletId, t.createdAt)],
);

export const posOrderItems = pgTable(
  'pos_order_items',
  {
    id: id(),
    orgId: orgRef(),
    orderId: uuid()
      .notNull()
      .references(() => posOrders.id, { onDelete: 'cascade' }),
    productId: uuid().references(() => products.id, { onDelete: 'set null' }),
    name: text().notNull(),
    quantity: qty().notNull().default(1),
    unitPrice: money().notNull(),
    vatRate: rate().notNull().default(20),
    notes: text(),
  },
  (t) => [index('pos_order_items_order_idx').on(t.orderId)],
);

export const spaServices = pgTable('spa_services', {
  id: id(),
  orgId: orgRef(),
  name: jsonb().$type<Localized>().notNull(),
  description: jsonb().$type<Localized>(),
  durationMin: integer().notNull(),
  price: money().notNull(),
  vatRate: rate().notNull().default(20),
  imageUrl: text(),
  isActive: boolean().notNull().default(true),
  sortOrder: integer().notNull().default(0),
});

export const spaTherapists = pgTable('spa_therapists', {
  id: id(),
  orgId: orgRef(),
  name: text().notNull(),
  specialties: text(),
  isActive: boolean().notNull().default(true),
});

export const spaAppointments = pgTable(
  'spa_appointments',
  {
    id: id(),
    orgId: orgRef(),
    serviceId: uuid()
      .notNull()
      .references(() => spaServices.id, { onDelete: 'restrict' }),
    therapistId: uuid().references(() => spaTherapists.id, { onDelete: 'set null' }),
    guestId: uuid().references(() => guests.id, { onDelete: 'set null' }),
    bookingId: uuid().references(() => bookings.id, { onDelete: 'set null' }),
    guestName: text(),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    status: appointmentStatus().notNull().default('booked'),
    price: money().notNull(),
    chargedToFolio: boolean().notNull().default(false),
    notes: text(),
    createdAt: createdAt(),
  },
  (t) => [index('spa_appointments_org_starts_idx').on(t.orgId, t.startsAt)],
);
