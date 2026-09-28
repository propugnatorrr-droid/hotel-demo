import { numeric, timestamp, uuid } from 'drizzle-orm/pg-core';

export type Localized = { sq: string; en: string };

export const id = () => uuid().primaryKey().defaultRandom();

export const money = () => numeric({ precision: 12, scale: 2, mode: 'number' });
export const rate = () => numeric({ precision: 5, scale: 2, mode: 'number' });
export const qty = () => numeric({ precision: 12, scale: 3, mode: 'number' });

export const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
export const updatedAt = () =>
  timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
