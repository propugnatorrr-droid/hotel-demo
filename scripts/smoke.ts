/**
 * Local smoke test: boots an in-memory Postgres (PGlite), pushes the schema, runs the real demo seed,
 * then exercises every raw-SQL query and service against it. No network, no Supabase.
 *
 *   npm run smoke
 */
process.env.SEED_OFFLINE = '1';
process.env.SEED_NO_AUTORUN = '1';
process.env.DEMO_PASSWORD = 'smoke-test-pass';
process.env.CRON_SECRET = 'smoke';

// `server-only` throws outside the Next.js server runtime; stub it for this script.
import Module from 'node:module';
import { join } from 'node:path';
const resolver = Module as unknown as { _resolveFilename: (request: string, ...rest: unknown[]) => string };
const original = resolver._resolveFilename;
const STUBS: Record<string, string> = {
  'server-only': 'empty-stub.cjs',
  'next/cache': 'stub-next-cache.cjs',
  'next/navigation': 'stub-next-navigation.cjs',
};
resolver._resolveFilename = function (request: string, ...rest: unknown[]) {
  const stub = STUBS[request] ?? (/lib\/auth\/session$/.test(request) ? 'stub-session.cjs' : null);
  return stub ? join(process.cwd(), 'scripts', stub) : original.call(this, request, ...rest);
};

import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { drizzle } from 'drizzle-orm/pglite';
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api';
import { eq } from 'drizzle-orm';
import { readFileSync } from 'node:fs';
import * as schema from '../src/db/schema';

let failures = 0;
async function check<T>(name: string, fn: () => Promise<T>, assert?: (r: T) => string | null) {
  try {
    const r = await fn();
    const problem = assert ? assert(r) : null;
    if (problem) {
      failures++;
      console.log(`  ✗ ${name}: ${problem}`);
    } else console.log(`  ✓ ${name}`);
    return r;
  } catch (e) {
    failures++;
    console.log(`  ✗ ${name}: ${e instanceof Error ? e.message.split('\n')[0] : e}`);
    return undefined as T;
  }
}

async function main() {
  const pg = new PGlite({ extensions: { btree_gist } });
  const db = drizzle(pg, { schema, casing: 'snake_case' });
  // postgres-js returns a bare row array from db.execute(); PGlite wraps it in { rows }. Match production.
  const exec = db.execute.bind(db);
  (db as unknown as { execute: unknown }).execute = async (query: never) => {
    const r = (await exec(query)) as unknown as { rows?: unknown[] };
    return r.rows ?? r;
  };
  (globalThis as unknown as { drizzleDb: unknown }).drizzleDb = db;

  console.log('Schema');
  // Same DDL `drizzle-kit push` produces for this repo (snake_case casing from drizzle.config.ts).
  const empty = generateDrizzleJson({}, undefined, undefined, 'snake_case');
  const next = generateDrizzleJson(schema as never, empty.id, undefined, 'snake_case');
  const statements = await generateMigration(empty, next);
  for (const st of statements) await pg.exec(st);
  console.log(`  ✓ created schema (${statements.length} statements)`);
  await pg.exec(readFileSync('supabase/sql/06_booking_integrity.sql', 'utf8'));
  console.log('  ✓ booking integrity constraints');

  console.log('Seed');
  const { main: seed } = await import('../src/db/seed/index');
  await seed();

  const { organizations, memberships, profiles, orgModules } = schema;
  const [org] = await db.select().from(organizations).where(eq(organizations.slug, 'vala')).limit(1);
  if (!org) throw new Error('seed produced no org');
  const [owner] = await db.select({ p: profiles }).from(memberships).innerJoin(profiles, eq(profiles.id, memberships.userId)).where(eq(memberships.role, 'owner')).limit(1);
  const mods = await db.select().from(orgModules).where(eq(orgModules.orgId, org.id));
  const ctx = {
    user: { id: owner!.p.id, email: owner!.p.email }, profile: owner!.p, org, role: 'owner' as const, orgs: [],
    modules: new Set(mods.filter((m) => m.enabled).map((m) => m.module)),
  };
  const today = new Date().toISOString().slice(0, 10);
  const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

  console.log('Queries');
  const q = {
    calendar: await import('../src/server/queries/calendar'),
    analytics: await import('../src/server/queries/analytics'),
    finance: await import('../src/server/queries/finance'),
    reports: await import('../src/server/queries/reports'),
    inbox: await import('../src/server/queries/inbox'),
    invoices: await import('../src/server/queries/invoices'),
    pos: await import('../src/server/queries/pos'),
    spa: await import('../src/server/queries/spa'),
    expenses: await import('../src/server/queries/expenses'),
    channels: await import('../src/server/queries/channels'),
    settings: await import('../src/server/queries/settings'),
    admin: await import('../src/server/queries/admin'),
    voice: await import('../src/server/queries/voice'),
    dashboard: await import('../src/server/queries/dashboard'),
    bookings: await import('../src/server/queries/bookings'),
  };

  await check('calendar', () => q.calendar.getCalendar(ctx as never, addDays(today, -2), 14, 'sq'), (r) => (r.rooms.length > 20 && r.bookings.length > 5 ? null : `rooms=${r.rooms.length} bookings=${r.bookings.length}`));
  await check('period stats', () => q.analytics.getPeriodStats(ctx as never, addDays(today, -30), addDays(today, -1)), (r) => (r.totalRevenue > 0 && r.occupancy > 0 ? null : JSON.stringify(r)));
  await check('channel breakdown', () => q.analytics.getChannelBreakdown(ctx as never, addDays(today, -30), today), (r) => (r.length ? null : 'empty'));
  await check('outlet sales', () => q.analytics.getOutletSales(ctx as never, addDays(today, -14), today), (r) => (r.length ? null : 'empty'));
  await check('expenses by dept', () => q.analytics.getExpensesByDept(ctx as never, addDays(today, -60), today), (r) => (r.total > 0 ? null : 'zero'));
  await check('occupancy by day', () => q.analytics.getOccupancyByDay(ctx as never, today, 14), (r) => (r.length ? null : 'empty'));
  await check('pricing suggestions', () => q.analytics.getPricingSuggestions(ctx as never, today));
  await check('top guests', () => q.analytics.getTopGuests(ctx as never, 5), (r) => (r.length ? null : 'empty'));
  await check('open alerts', () => q.analytics.getOpenAlerts(ctx as never), (r) => (r.length ? null : 'empty'));
  await check('profit (6 months)', () => q.finance.getProfit(ctx as never, 6), (r) => (r.months.some((m) => m.income > 0) ? null : 'no income'));
  await check('daily series', () => q.reports.getDailySeries(ctx as never, addDays(today, -14), today), (r) => (r.length === 15 ? null : `len=${r.length}`));
  await check('full report', () => q.reports.getReport(ctx as never, addDays(today, -30), today, null));
  await check('inbox list', () => q.inbox.listConversations(ctx as never, 'all'), (r) => (r.length ? null : 'empty'));
  await check('inbox counts', () => q.inbox.getInboxCounts(ctx as never));
  const convs = await q.inbox.listConversations(ctx as never, 'all');
  await check('inbox thread', () => q.inbox.getThread(ctx as never, convs[0]?.id, 'sq'), (r) => (r && r.messages.length ? null : 'no thread'));
  await check('invoices list', () => q.invoices.listInvoices(ctx as never, 'all', ''), (r) => (r.length ? null : 'empty'));
  await check('invoice counts', () => q.invoices.getInvoiceCounts(ctx as never));
  const invs = await q.invoices.listInvoices(ctx as never, 'all', '');
  await check('invoice detail + QR', () => q.invoices.getInvoice(ctx as never, invs[0]?.id), (r) => (r?.qr ? null : 'no qr'));
  await check('invoiceable', () => q.invoices.getInvoiceable(ctx as never));
  await check('cash', () => q.invoices.getCash(ctx as never), (r) => (r.recent.length ? null : 'empty'));
  await check('pos', () => q.pos.getPos(ctx as never, undefined, 'sq'), (r) => (r.products.length ? null : 'no products'));
  await check('spa day', () => q.spa.getSpa(ctx as never, today, 'sq'), (r) => (r.services.length ? null : 'no services'));
  await check('expenses list', () => q.expenses.listExpenses(ctx as never, today.slice(0, 7), 'all', ''), (r) => (Array.isArray(r) ? null : 'bad'));
  await check('channels', () => q.channels.getChannels(ctx as never, 'sq'), (r) => (r.mappings.length ? null : 'no mappings'));
  await check('settings', () => q.settings.getSettings(ctx as never), (r) => (r.types.length ? null : 'no types'));
  await check('admin overview', () => q.admin.getAdminOverview(), (r) => (r.length ? null : 'empty'));
  await check('voice', () => q.voice.getVoice(ctx as never, 'sq'), (r) => (r.calls.length ? null : 'no calls'));
  await check('dashboard', () => q.dashboard.getDashboard(ctx as never));
  await check('bookings list', () => q.bookings.listBookings(ctx as never, 'all', ''), (r) => (r.length ? null : 'empty'));

  console.log('Services');
  const stay = await import('../src/server/services/stay');
  const { roomTypes } = schema;
  const [type] = await db.select().from(roomTypes).where(eq(roomTypes.orgId, org.id)).limit(1);
  await check('quoteStay', () => stay.quoteStay(db as never, { orgId: org.id, roomTypeId: type!.id, checkIn: addDays(today, 200), checkOut: addDays(today, 203), guests: 2 }), (r) => (r.ok ? null : `fail: ${JSON.stringify(r)}`));
  await check('priceNights', () => stay.priceNights(db as never, { orgId: org.id, roomTypeId: type!.id, checkIn: addDays(today, 200), checkOut: addDays(today, 202) }), (r) => (r && r.total > 0 ? null : 'null'));

  const sync = await import('../src/server/services/channel-sync');
  await check('computeAvailability', () => sync.computeAvailability(org.id, today, 30), (r) => (r.length ? null : 'empty'));
  await check('pushChannel (mock)', () => sync.pushChannel(org.id, 30), (r) => (r.mode === 'mock' ? null : r.mode));

  const anomalies = await import('../src/server/services/anomalies');
  await check('detectAnomalies', () => anomalies.detectAnomalies(org));
  await check('raisePricingAlerts', () => anomalies.raisePricingAlerts(ctx as never));

  const report = await import('../src/server/services/morning-report');
  await check('morning report (template)', () => report.buildMorningReport(ctx as never, 'sq'), (r) => (r.story.length > 20 ? null : 'short'));

  const journey = await import('../src/server/services/journey');
  await check('guest journey', () => journey.runJourney(org));

  const web = await import('../src/server/services/web-booking');
  const pub = await (await import('../src/server/services/public-site')).getPublicOrg('vala');
  await check('public org', async () => pub, (r) => (r ? null : 'null'));
  const booked = await check('web booking (transaction + lock + email mock)', () => web.createWebBookingCore(pub!, { slug: 'vala', locale: 'sq', roomTypeId: type!.id, checkIn: addDays(today, 120), checkOut: addDays(today, 123), adults: 2, children: 0, first: 'Test', last: 'Guest', email: 'smoke@example.com', phone: '+355691234567', pay: 'deposit', source: 'website' }), (r) => (r.code ? null : 'no code'));
  if (booked) {
    const pubSite = await import('../src/server/services/public-site');
    await check('online payment applied + idempotent', async () => {
      const a = await pubSite.applyOnlinePayment({ orgId: org.id, code: booked.code, amount: booked.booking.depositAmount, providerRef: 'smoke-1' });
      const b = await pubSite.applyOnlinePayment({ orgId: org.id, code: booked.code, amount: booked.booking.depositAmount, providerRef: 'smoke-1' });
      return { a, b };
    }, (r) => (r.a.ok && r.b.ok && 'duplicate' in r.b && r.b.duplicate ? null : JSON.stringify(r)));
  }

  const invoicing = await import('../src/server/services/invoicing');
  await check('invoice number sequence', () => db.transaction(async (tx) => invoicing.nextInvoiceNumber(tx as never, org.id, 2099)), (r) => (r === '1/2099' ? null : r));
  const [{ id: someFolio }] = (await db.select({ id: schema.folios.id }).from(schema.folios).limit(1)) as { id: string }[];
  await check('lines for folio', () => db.transaction(async (tx) => invoicing.linesForFolio(tx as never, org.id, someFolio)), (r) => (r.lines.length ? null : 'empty'));

  const ical = await import('../src/lib/integrations/ical');
  await check('ical build/parse roundtrip', async () => ical.parseIcs(ical.buildIcs('x', [{ uid: 'a@b', start: '2027-01-01', end: '2027-01-04', summary: 'Reserved' }])), (r) => (r[0]?.start === '2027-01-01' && r[0]?.end === '2027-01-04' ? null : JSON.stringify(r)));

  console.log('Actions');
  const { runActions } = await import('./smoke-actions');
  await runActions({ db: db as never, ctx: ctx as never, org, today, addDays, check });

  console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
  await pg.close();
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
