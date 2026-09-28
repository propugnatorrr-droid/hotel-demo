import { date, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id, money, qty, rate, updatedAt } from './columns';
import { bookingSource, bookingStatus, currency, folioItemType, folioStatus } from './enums';
import { guests } from './guests';
import { roomTypes, rooms } from './rooms';
import { orgRef, profiles } from './tenancy';

export const bookings = pgTable(
  'bookings',
  {
    id: id(),
    orgId: orgRef(),
    code: text().notNull(),
    groupId: uuid(),
    guestId: uuid()
      .notNull()
      .references(() => guests.id, { onDelete: 'restrict' }),
    roomTypeId: uuid()
      .notNull()
      .references(() => roomTypes.id, { onDelete: 'restrict' }),
    roomId: uuid().references(() => rooms.id, { onDelete: 'set null' }),
    checkIn: date({ mode: 'string' }).notNull(),
    checkOut: date({ mode: 'string' }).notNull(),
    adults: integer().notNull().default(2),
    children: integer().notNull().default(0),
    status: bookingStatus().notNull().default('confirmed'),
    source: bookingSource().notNull().default('direct'),
    channelRef: text(),
    totalAmount: money().notNull().default(0),
    depositAmount: money().notNull().default(0),
    paidAmount: money().notNull().default(0),
    commissionAmount: money().notNull().default(0),
    currency: currency().notNull().default('EUR'),
    eta: text(),
    specialRequests: text(),
    notes: text(),
    createdBy: uuid().references(() => profiles.id, { onDelete: 'set null' }),
    checkedInAt: timestamp({ withTimezone: true }),
    checkedOutAt: timestamp({ withTimezone: true }),
    cancelledAt: timestamp({ withTimezone: true }),
    cancelReason: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('bookings_org_code_uq').on(t.orgId, t.code),
    index('bookings_org_dates_idx').on(t.orgId, t.checkIn, t.checkOut),
    index('bookings_org_room_idx').on(t.orgId, t.roomId),
    index('bookings_org_guest_idx').on(t.orgId, t.guestId),
    index('bookings_org_status_idx').on(t.orgId, t.status),
  ],
);

export const folios = pgTable(
  'folios',
  {
    id: id(),
    orgId: orgRef(),
    bookingId: uuid().references(() => bookings.id, { onDelete: 'set null' }),
    guestId: uuid().references(() => guests.id, { onDelete: 'set null' }),
    status: folioStatus().notNull().default('open'),
    currency: currency().notNull().default('EUR'),
    openedAt: createdAt(),
    closedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index('folios_org_booking_idx').on(t.orgId, t.bookingId)],
);

export const folioItems = pgTable(
  'folio_items',
  {
    id: id(),
    orgId: orgRef(),
    folioId: uuid()
      .notNull()
      .references(() => folios.id, { onDelete: 'cascade' }),
    type: folioItemType().notNull(),
    description: text().notNull(),
    quantity: qty().notNull().default(1),
    unitPrice: money().notNull(),
    amount: money().notNull(),
    vatRate: rate().notNull().default(20),
    outletId: uuid(),
    sourceRef: text(),
    postedBy: uuid().references(() => profiles.id, { onDelete: 'set null' }),
    postedAt: createdAt(),
  },
  (t) => [index('folio_items_folio_idx').on(t.folioId)],
);
