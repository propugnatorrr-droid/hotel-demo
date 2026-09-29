/** Drives the real server actions end-to-end against the in-memory database (see smoke.ts). */
import { and, eq, gt } from 'drizzle-orm';
import * as schema from '../src/db/schema';

type R = { ok: boolean; error?: string; data?: unknown };
type Check = <T>(name: string, fn: () => Promise<T>, assert?: (r: T) => string | null) => Promise<T>;

export async function runActions(opts: { db: never; ctx: never; org: { id: string; name: string }; today: string; addDays: (d: string, n: number) => string; check: Check }) {
  const { ctx, org, today, addDays, check } = opts;
  const db = opts.db as unknown as import('drizzle-orm/pglite').PgliteDatabase<typeof schema>;
  (globalThis as unknown as { __smokeCtx: unknown }).__smokeCtx = ctx;

  const A = {
    bookings: await import('../src/server/actions/bookings'),
    calendar: await import('../src/server/actions/calendar'),
    pos: await import('../src/server/actions/pos'),
    spa: await import('../src/server/actions/spa'),
    invoices: await import('../src/server/actions/invoices'),
    expenses: await import('../src/server/actions/expenses'),
    settings: await import('../src/server/actions/settings'),
    inbox: await import('../src/server/actions/inbox'),
    channels: await import('../src/server/actions/channels'),
    public: await import('../src/server/actions/public'),
  };
  const Q = {
    pos: await import('../src/server/queries/pos'),
    spa: await import('../src/server/queries/spa'),
    invoices: await import('../src/server/queries/invoices'),
    inbox: await import('../src/server/queries/inbox'),
  };
  const stay = await import('../src/server/services/stay');
  const ok = (r: unknown) => ((r as R).ok ? null : `error=${(r as R).error}`);
  const { bookings: B, folios: F, roomTypes } = schema;

  const [t2, t3] = await db.select().from(roomTypes).where(eq(roomTypes.orgId, org.id)).limit(2);

  const life = (await check('createBooking (front desk)', () => A.bookings.createBooking({ roomTypeId: t2!.id, checkIn: addDays(today, 60), checkOut: addDays(today, 63), adults: 2, children: 0, source: 'phone', status: 'tentative', autoAssign: true, guest: { firstName: 'Smoke', lastName: 'Tester', email: 'life@example.com', phone: '+355690000001' } }), ok)) as R | undefined;
  const bid = (life?.data as { id: string } | undefined)?.id;
  if (bid) {
    await check('confirmBooking', () => A.bookings.confirmBooking(bid), ok);
    await check('moveBooking dates +2 days', () => A.calendar.moveBooking({ bookingId: bid, checkIn: addDays(today, 62), checkOut: addDays(today, 65) }), ok);
    const [bk] = await db.select().from(B).where(eq(B.id, bid));
    const free = await stay.findFreeRooms(db as never, { orgId: org.id, roomTypeId: t2!.id, checkIn: bk!.checkIn, checkOut: bk!.checkOut, excludeBookingId: bid });
    const other = free.find((r) => r.id !== bk!.roomId);
    if (other) await check('moveBooking to another room', () => A.calendar.moveBooking({ bookingId: bid, roomId: other.id }), ok);
    await check('recordPayment', () => A.bookings.recordPayment({ bookingId: bid, amount: 50, method: 'cash', refund: false }), ok);
    await check('cancelBooking', () => A.bookings.cancelBooking({ bookingId: bid, reason: 'smoke test' }), ok);
  }

  const [inh] = await db.select({ id: B.id }).from(B).where(and(eq(B.orgId, org.id), eq(B.status, 'checked_in'), gt(B.checkOut, today))).limit(1);
  if (inh) {
    await check('postCharge', () => A.bookings.postCharge({ bookingId: inh.id, type: 'service', description: 'Smoke charge', quantity: 1, unitPrice: 10 }), ok);
    const menu = await Q.pos.getPos(ctx, undefined, 'sq');
    const prods = menu.products.slice(0, 2).map((p) => ({ productId: p.id, quantity: 2 }));
    const saved = (await check('POS saveOrder (table, 5% discount, sent)', () => A.pos.saveOrder({ outletId: menu.outlet!.id, tableId: menu.tables[0]?.id, covers: 2, items: prods, discountPct: 5, send: true }), ok)) as R;
    const oid = (saved?.data as { orderId: string } | undefined)?.orderId;
    if (oid) await check('POS payOrder → room charge', () => A.pos.payOrder({ orderId: oid, method: 'room_charge', bookingId: inh.id }), ok);
    const saved2 = (await check('POS saveOrder #2', () => A.pos.saveOrder({ outletId: menu.outlet!.id, items: prods }), ok)) as R;
    const oid2 = (saved2?.data as { orderId: string } | undefined)?.orderId;
    await check('open cash shift', () => A.invoices.openShift({ openingCash: 100 }), ok);
    if (oid2) {
      await check('POS payOrder → cash', () => A.pos.payOrder({ orderId: oid2, method: 'cash' }), ok);
      const inv = (await check('issueInvoice (POS) + fiscalize', () => A.invoices.issueInvoice({ posOrderId: oid2, fiscalize: true }), (r) => ((r as R).ok && (r as { data: { status: string } }).data.status === 'fiscalized' ? null : JSON.stringify(r)))) as R;
      const iid = (inv?.data as { id: string } | undefined)?.id;
      if (iid) {
        await check('invoice has 32-hex NIVF + NSLF + QR', () => Q.invoices.getInvoice(ctx, iid), (r) => (r?.nivf && r.nslf && r.nivf.length === 32 && r.qr ? null : 'codes missing'));
        await check('duplicate invoice refused', () => A.invoices.issueInvoice({ posOrderId: oid2, fiscalize: false }), (r) => ((r as R).error === 'alreadyInvoiced' ? null : JSON.stringify(r)));
        await check('cancelInvoice', () => A.invoices.cancelInvoice({ invoiceId: iid, reason: 'smoke' }), ok);
      }
      const cash = await Q.invoices.getCash(ctx);
      if (cash.open) await check('close cash shift (raises difference alert)', () => A.invoices.closeShift({ shiftId: cash.open!.id, countedCash: 1 }), ok);
    }
    const spa = await Q.spa.getSpa(ctx, addDays(today, 1), 'sq');
    const ap = (await check('spa bookAppointment', () => A.spa.bookAppointment({ serviceId: spa.services[0]!.id, therapistId: spa.therapists[0]!.id, date: addDays(today, 40), time: '10:00', bookingId: inh.id }), ok)) as R;
    const apId = (ap?.data as { id: string } | undefined)?.id;
    if (apId) {
      await check('spa double-booking blocked', () => A.spa.bookAppointment({ serviceId: spa.services[0]!.id, therapistId: spa.therapists[0]!.id, date: addDays(today, 40), time: '10:15', guestName: 'X' }), (r) => ((r as R).error === 'therapistBusy' ? null : JSON.stringify(r)));
      await check('spa charge to room', () => A.spa.chargeAppointmentToRoom({ id: apId }), ok);
    }
    const [f] = await db.select({ id: F.id }).from(F).where(and(eq(F.bookingId, inh.id), eq(F.status, 'open'))).limit(1);
    if (f) await check('issueInvoice (folio)', () => A.invoices.issueInvoice({ folioId: f.id, fiscalize: false }), ok);
  }

  await check('setRates +10%', () => A.calendar.setRates({ roomTypeId: t3!.id, from: addDays(today, 5), to: addDays(today, 9), adjustPct: 10, weekdays: [0, 1, 2, 3, 4, 5, 6] }), ok);
  const exp = (await check('saveExpense', () => A.expenses.saveExpense({ supplierName: 'Smoke Supplier', category: 'Mirëmbajtje', department: 'maintenance', amount: 12000, vatAmount: 2000, currency: 'ALL', expenseDate: today, paymentMethod: 'cash' }), ok)) as R;
  const eid = (exp?.data as { id?: string } | undefined)?.id;
  if (eid) await check('deleteExpense', () => A.expenses.deleteExpense(eid), ok);
  await check('saveRoomType + addRoom', async () => {
    const t = (await A.settings.saveRoomType({ code: 'SMK', nameSq: 'Test', nameEn: 'Test', basePrice: 50, baseOccupancy: 2, maxOccupancy: 3 })) as R;
    if (!t.ok) return t;
    return A.settings.addRoom({ roomTypeId: (t.data as { id: string }).id, number: '999', floor: 9 });
  }, ok);
  await check('updateHotelProfile', () => A.settings.updateHotelProfile({ name: org.name, currency: 'EUR', defaultLocale: 'sq', fxAllPerEur: 98 }), ok);

  const conv = (await Q.inbox.listConversations(ctx, 'all'))[0];
  if (conv) {
    await check('inbox take over', () => A.inbox.setConversationState({ conversationId: conv.id, action: 'take' }), ok);
    await check('inbox sendStaffMessage', () => A.inbox.sendStaffMessage({ conversationId: conv.id, body: 'Smoke reply' }), ok);
  }
  await check('setIntegration mock', () => A.channels.setIntegration({ provider: 'channex', mode: 'mock', enabled: true }), ok);
  await check('live without keys refused', () => A.channels.setIntegration({ provider: 'channex', mode: 'live', enabled: true }), (r) => ((r as R).error === 'envMissing' ? null : JSON.stringify(r)));
  await check('iCal SSRF guard (http/localhost)', () => A.channels.saveMapping({ roomTypeId: t2!.id, channel: 'airbnb', icalImportUrl: 'http://localhost/x.ics' }), (r) => ((r as R).error === 'badUrl' ? null : JSON.stringify(r)));
  await check('public searchStay', () => A.public.searchStay({ slug: 'vala', checkIn: addDays(today, 90), checkOut: addDays(today, 93), adults: 2, children: 0, locale: 'sq' }), (r) => ((r as R).ok && (r as { data: { options: unknown[] } }).data.options.length ? null : JSON.stringify(r)));
  await check('public sendInquiry lands in inbox', () => A.public.sendInquiry({ slug: 'vala', name: 'Smoke', email: 'a@b.co', message: 'Pyetje për dasmë', locale: 'sq' }), ok);
}
