import { boolean, date, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { createdAt, id, money, qty, rate } from './columns';
import { bookings, folios } from './bookings';
import { currency, department, invoiceStatus, paymentMethod } from './enums';
import { guests } from './guests';
import { outlets, posOrders } from './pos';
import { orgRef, profiles } from './tenancy';

export const invoices = pgTable(
  'invoices',
  {
    id: id(),
    orgId: orgRef(),
    number: text().notNull(),
    folioId: uuid().references(() => folios.id, { onDelete: 'set null' }),
    posOrderId: uuid().references(() => posOrders.id, { onDelete: 'set null' }),
    guestId: uuid().references(() => guests.id, { onDelete: 'set null' }),
    buyerName: text(),
    buyerNipt: text(),
    buyerAddress: text(),
    issuedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    subtotal: money().notNull(),
    vatTotal: money().notNull(),
    total: money().notNull(),
    currency: currency().notNull().default('EUR'),
    exchangeRate: rate(),
    paymentMethod: paymentMethod(),
    status: invoiceStatus().notNull().default('draft'),
    nivf: text(),
    nslf: text(),
    qrUrl: text(),
    fiscalProvider: text(),
    fiscalResponse: jsonb().$type<Record<string, unknown>>(),
    pdfPath: text(),
    cancelledAt: timestamp({ withTimezone: true }),
    cancelReason: text(),
    issuedBy: uuid().references(() => profiles.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('invoices_org_number_uq').on(t.orgId, t.number),
    index('invoices_org_issued_idx').on(t.orgId, t.issuedAt),
  ],
);

export const invoiceLines = pgTable(
  'invoice_lines',
  {
    id: id(),
    orgId: orgRef(),
    invoiceId: uuid()
      .notNull()
      .references(() => invoices.id, { onDelete: 'cascade' }),
    description: text().notNull(),
    quantity: qty().notNull().default(1),
    unitPrice: money().notNull(),
    vatRate: rate().notNull(),
    amount: money().notNull(),
  },
  (t) => [index('invoice_lines_invoice_idx').on(t.invoiceId)],
);

export const cashShifts = pgTable(
  'cash_shifts',
  {
    id: id(),
    orgId: orgRef(),
    userId: uuid()
      .notNull()
      .references(() => profiles.id, { onDelete: 'no action' }),
    outletId: uuid().references(() => outlets.id, { onDelete: 'set null' }),
    openedAt: createdAt(),
    closedAt: timestamp({ withTimezone: true }),
    openingCash: money().notNull().default(0),
    expectedCash: money(),
    countedCash: money(),
    difference: money(),
    notes: text(),
  },
  (t) => [index('cash_shifts_org_opened_idx').on(t.orgId, t.openedAt)],
);

export const payments = pgTable(
  'payments',
  {
    id: id(),
    orgId: orgRef(),
    folioId: uuid().references(() => folios.id, { onDelete: 'set null' }),
    invoiceId: uuid().references(() => invoices.id, { onDelete: 'set null' }),
    bookingId: uuid().references(() => bookings.id, { onDelete: 'set null' }),
    posOrderId: uuid().references(() => posOrders.id, { onDelete: 'set null' }),
    shiftId: uuid().references(() => cashShifts.id, { onDelete: 'set null' }),
    amount: money().notNull(),
    currency: currency().notNull().default('EUR'),
    method: paymentMethod().notNull(),
    isDeposit: boolean().notNull().default(false),
    isRefund: boolean().notNull().default(false),
    reference: text(),
    providerRef: text(),
    receivedBy: uuid().references(() => profiles.id, { onDelete: 'set null' }),
    receivedAt: createdAt(),
  },
  (t) => [index('payments_org_received_idx').on(t.orgId, t.receivedAt)],
);

export const expenses = pgTable(
  'expenses',
  {
    id: id(),
    orgId: orgRef(),
    supplierName: text().notNull(),
    supplierNipt: text(),
    invoiceNumber: text(),
    category: text().notNull(),
    department: department().notNull().default('other'),
    description: text(),
    amount: money().notNull(),
    vatAmount: money().notNull().default(0),
    currency: currency().notNull().default('ALL'),
    expenseDate: date({ mode: 'string' }).notNull(),
    paymentMethod: paymentMethod(),
    receiptPath: text(),
    ocrData: jsonb().$type<Record<string, unknown>>(),
    ocrConfidence: rate(),
    createdBy: uuid().references(() => profiles.id, { onDelete: 'set null' }),
    createdAt: createdAt(),
  },
  (t) => [index('expenses_org_date_idx').on(t.orgId, t.expenseDate)],
);
