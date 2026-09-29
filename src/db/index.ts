import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const globalForDb = globalThis as unknown as {
  pgClient?: ReturnType<typeof postgres>;
  drizzleDb?: ReturnType<typeof create>;
};

function create() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const client = globalForDb.pgClient ?? postgres(url, { prepare: false, max: 5 });
  globalForDb.pgClient = client;
  return drizzle(client, { schema, casing: 'snake_case' });
}

function instance() {
  return (globalForDb.drizzleDb ??= create());
}

/** Lazy: connecting only when first used, so `next build` works without env vars. */
export const db = new Proxy({} as ReturnType<typeof create>, {
  get(_t, prop) {
    const target = instance() as unknown as Record<string | symbol, unknown>;
    const value = target[prop];
    return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
  },
});
export type DB = ReturnType<typeof create>;
