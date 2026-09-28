import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const globalForDb = globalThis as unknown as { pgClient?: ReturnType<typeof postgres> };

function getClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  return postgres(url, { prepare: false, max: 5 });
}

const client = globalForDb.pgClient ?? getClient();
if (process.env.NODE_ENV !== 'production') globalForDb.pgClient = client;

export const db = drizzle(client, { schema, casing: 'snake_case' });
export type DB = typeof db;
