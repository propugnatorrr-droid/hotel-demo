import './env';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { eq, type InferInsertModel } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { db } from '../index';
import * as s from '../schema';
import type { Localized } from '../schema/columns';
import * as D from './data';
import { addDays, at, dateRange, dayInTirana, diffDays, isWeekendNight, seasonFactor, todayInTirana } from './dates';
import { createRng } from './random';

type Insert<T extends PgTable> = InferInsertModel<T>;
type BookingStatus = (typeof s.bookingStatus.enumValues)[number];

const rng = createRng(20260928);
const uuid = () => crypto.randomUUID();
const r2 = (n: number) => Math.round(n * 100) / 100;
const vatOf = (gross: number, rate: number) => r2(gross - gross / (1 + rate / 100));
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000);
const plusMinutes = (d: Date, m: number) => new Date(d.getTime() + m * 60_000);
const ascii = (v: string) =>
  v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/ß/g, 'ss').toLowerCase().replace(/[^a-z]/g, '');

async function insertMany<T extends PgTable>(table: T, rows: Insert<T>[]) {
  for (let i = 0; i < rows.length; i += 500) {
    await db.insert(table).values(rows.slice(i, i + 500) as never);
  }
}

async function ensureUser(sb: SupabaseClient, email: string, fullName: string, password: string) {
  const created = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, locale: 'sq' },
  });
  if (created.data.user) return created.data.user.id;

  for (let page = 1; page < 20; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) {
      await sb.auth.admin.updateUserById(found.id, { password, user_metadata: { full_name: fullName } });
      return found.id;
    }
    if (data.users.length < 200) break;
  }
  throw created.error ?? new Error(`Could not create user ${email}`);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const password = process.env.DEMO_PASSWORD;
  if (!url || !serviceKey) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
  if (!password || password.length < 8) throw new Error('Set DEMO_PASSWORD (min 8 characters) in .env.local');

  const sb = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const today = todayInTirana();
  const yesterday = addDays(today, -1);
  const year = today.slice(0, 4);
  const now = new Date();
  console.log(`Seeding ${D.ORG.name} · today ${today}`);

  // ─── Users ───────────────────────────────────────────────
  const userIds = {} as Record<D.DemoUserKey, string>;
  for (const u of D.USERS) {
    const id = await ensureUser(sb, u.email, u.fullName, password);
    const isSuperAdmin = u.key === 'admin';
    await db
      .insert(s.profiles)
      .values({ id, email: u.email, fullName: u.fullName, locale: 'sq', isSuperAdmin })
      .onConflictDoUpdate({ target: s.profiles.id, set: { email: u.email, fullName: u.fullName, isSuperAdmin } });
    userIds[u.key] = id;
  }

  // ─── Reset demo org (cascades to everything) ─────────────
  await db.delete(s.organizations).where(eq(s.organizations.slug, D.ORG.slug));
  const orgId = uuid();

  const orgRow: Insert<typeof s.organizations> = {
    id: orgId, ...D.ORG, currency: 'EUR', plan: 'premium', status: 'demo', isDemo: true,
  };
  const membershipRows: Insert<typeof s.memberships>[] = D.USERS.filter((u) => u.role).map((u) => ({
    orgId, userId: userIds[u.key], role: u.role!,
  }));
  const moduleRows: Insert<typeof s.orgModules>[] = s.moduleKey.enumValues.map((module) => ({ orgId, module, enabled: true }));
  const integrationRows: Insert<typeof s.integrations>[] = D.INTEGRATIONS.map((provider) => ({ orgId, provider, mode: 'mock' }));

  // ─── Rooms ───────────────────────────────────────────────
  const typeRows: (Insert<typeof s.roomTypes> & { id: string })[] = D.ROOM_TYPES.map((t, i) => ({
    id: uuid(), orgId, code: t.code, name: t.name, description: t.description, baseOccupancy: t.baseOccupancy,
    maxOccupancy: t.maxOccupancy, basePrice: t.basePrice, sizeSqm: t.sizeSqm, bedType: t.bedType, view: t.view,
    amenities: t.amenities, sortOrder: i,
  }));
  const typeByCode = new Map(D.ROOM_TYPES.map((t, i) => [t.code, { ...t, id: typeRows[i]!.id }]));
  const rateOf = (code: string, d: string) =>
    Math.round(typeByCode.get(code)!.basePrice * seasonFactor(d) * (isWeekendNight(d) ? 1.1 : 1));

  type RoomRow = Insert<typeof s.rooms> & { id: string; typeCode: string; number: string };
  const roomRows: RoomRow[] = D.ROOM_TYPES.flatMap((t) =>
    t.rooms.map((number, i) => ({
      id: uuid(), orgId, roomTypeId: typeByCode.get(t.code)!.id, typeCode: t.code, number, floor: t.floor,
      building: t.building ?? null, layout: { x: t.layoutStart + i, y: t.floor, w: 1, h: 1 },
    })),
  );

  const rateRows: Insert<typeof s.dailyRates>[] = typeRows.flatMap((t) =>
    dateRange(addDays(today, -60), addDays(today, 180)).map((date) => ({
      orgId, roomTypeId: t.id, date, price: rateOf(t.code!, date), minStay: t.code === 'VIL' ? 3 : 1,
    })),
  );

  // ─── Guests ──────────────────────────────────────────────
  const guestRows: (Insert<typeof s.guests> & { id: string })[] = Array.from({ length: 180 }, () => {
    const nat = rng.weighted(D.NATIONALITY_WEIGHTS);
    const pool = D.NAME_POOLS[nat];
    const firstName = rng.pick(pool.first);
    const lastName = rng.pick(pool.last);
    const isVip = rng.chance(0.06);
    return {
      id: uuid(), orgId, firstName, lastName,
      email: `${ascii(firstName)}.${ascii(lastName)}${rng.int(1, 99)}@example.com`,
      phone: pool.phone + rng.digits(pool.digits), nationality: nat, country: nat, language: pool.lang,
      documentType: 'passport', documentNumber: nat + rng.digits(7), isVip, tags: isVip ? ['vip'] : [],
      marketingConsent: rng.chance(0.4),
    };
  });
  const guestById = new Map(guestRows.map((g) => [g.id, g]));
  const guestName = (id: string) => {
    const g = guestById.get(id)!;
    return `${g.firstName} ${g.lastName}`;
  };

  // ─── Bookings ────────────────────────────────────────────
  type BookingRow = Insert<typeof s.bookings> & {
    id: string; guestId: string; checkIn: string; checkOut: string; nights: number; typeCode: string; roomNumber: string;
    status: BookingStatus; totalAmount: number; paidAmount: number; depositAmount: number;
  };
  const bookingRows: BookingRow[] = [];

  const makeBooking = (room: RoomRow, checkIn: string, checkOut: string, nights: number): BookingRow => {
    const source = rng.weighted<(typeof s.bookingSource.enumValues)[number]>(room.typeCode === 'VIL' ? D.SOURCE_WEIGHTS_VILLA : D.SOURCE_WEIGHTS);
    const guest = rng.pick(guestRows);
    const type = typeByCode.get(room.typeCode)!;
    const total = dateRange(checkIn, checkOut).reduce((sum, n) => sum + rateOf(room.typeCode, n), 0);

    let status: BookingStatus;
    if (checkOut < today) status = rng.chance(0.05) ? 'cancelled' : rng.chance(0.015) ? 'no_show' : 'checked_out';
    else if (checkIn > today) status = rng.chance(0.06) ? 'cancelled' : rng.chance(0.08) ? 'tentative' : 'confirmed';
    else if (checkIn === today) status = 'confirmed';
    else status = 'checked_in';

    const inactive = status === 'cancelled' || status === 'no_show';
    const prepaid = D.PREPAID_SOURCES.includes(source);
    const deposit = D.DEPOSIT_SOURCES.includes(source) && rng.chance(0.6) ? r2(total * 0.3) : 0;
    const paid = inactive ? 0 : status === 'checked_out' || prepaid ? total : deposit;
    const channelRef =
      source === 'booking_com' ? rng.digits(10)
      : source === 'airbnb' ? `HM${rng.alnum(8)}`
      : source === 'expedia' || source === 'agoda' ? rng.digits(9)
      : null;
    const children = type.maxOccupancy > 3 ? rng.int(0, 2) : 0;

    return {
      id: uuid(), orgId, code: '', guestId: guest.id, roomTypeId: type.id, roomId: inactive ? null : room.id,
      checkIn, checkOut, nights, typeCode: room.typeCode, roomNumber: room.number,
      adults: rng.int(1, Math.min(2, type.maxOccupancy)), children, status, source, channelRef,
      totalAmount: total, depositAmount: deposit, paidAmount: paid, commissionAmount: r2(total * (D.COMMISSION[source] ?? 0)),
      currency: 'EUR', eta: `${rng.int(13, 21)}:00`,
      createdBy: ['direct', 'phone', 'walk_in'].includes(source) ? userIds.receptionist : null,
      checkedInAt: status === 'checked_in' || status === 'checked_out' ? at(checkIn, rng.int(13, 20), rng.int(0, 59)) : null,
      checkedOutAt: status === 'checked_out' ? at(checkOut, rng.int(8, 11), rng.int(0, 59)) : null,
      cancelledAt: status === 'cancelled' ? at(addDays(checkIn, -rng.int(2, 20)), rng.int(9, 21)) : null,
      cancelReason: status === 'cancelled' ? 'Ndryshim planesh' : null,
      createdAt: at(addDays(checkIn, -rng.int(1, 75)), rng.int(8, 23), rng.int(0, 59)),
    };
  };

  const windowStart = addDays(today, -60);
  const windowEnd = addDays(today, 90);
  for (const room of roomRows) {
    const isVilla = room.typeCode === 'VIL';
    let d = addDays(windowStart, -rng.int(0, 5));
    while (d < windowEnd) {
      const ahead = diffDays(d, today);
      let p = ahead <= 0 ? 0.8 : ahead < 14 ? 0.7 : ahead < 45 ? 0.42 : 0.2;
      p *= Math.min(1, seasonFactor(d) / 1.25 + 0.15);
      if (!rng.chance(p)) {
        d = addDays(d, 1);
        continue;
      }
      const nights = isVilla ? rng.int(3, 7) : rng.int(1, 6);
      const checkIn = d;
      const checkOut = addDays(d, nights);
      d = addDays(checkOut, rng.int(0, 2));
      if (room.number === D.OUT_OF_ORDER_ROOM && checkIn <= today && checkOut > today) continue;
      bookingRows.push(makeBooking(room, checkIn, checkOut, nights));
    }
  }
  bookingRows.sort((a, b) => a.checkIn.localeCompare(b.checkIn) || a.roomNumber.localeCompare(b.roomNumber));
  bookingRows.forEach((b, i) => (b.code = `VR-${b.checkIn.slice(0, 4)}-${String(i + 1).padStart(4, '0')}`));

  // One group booking
  const arrivals = new Map<string, BookingRow[]>();
  for (const b of bookingRows) {
    if (b.status !== 'confirmed' || b.checkIn <= addDays(today, 7)) continue;
    const list = arrivals.get(b.checkIn) ?? [];
    list.push(b);
    arrivals.set(b.checkIn, list);
  }
  const group = [...arrivals.values()].find((g) => g.length >= 3);
  if (group) {
    const groupId = uuid();
    for (const b of group.slice(0, 4)) {
      Object.assign(b, { groupId, guestId: group[0]!.guestId, source: 'direct', channelRef: null, commissionAmount: 0, notes: 'Grup: Tirana Tech Retreat' });
    }
  }

  // Returning guest tags
  const stays = new Map<string, number>();
  for (const b of bookingRows) if (b.status !== 'cancelled') stays.set(b.guestId, (stays.get(b.guestId) ?? 0) + 1);
  for (const g of guestRows) if ((stays.get(g.id) ?? 0) > 1) g.tags = [...(g.tags ?? []), 'returning'];

  // ─── Outlets & menus ─────────────────────────────────────
  const outletRows: Insert<typeof s.outlets>[] = [];
  const categoryRows: Insert<typeof s.productCategories>[] = [];
  const productRows: Insert<typeof s.products>[] = [];
  const tableRows: (Insert<typeof s.posTables> & { id: string })[] = [];
  const outletIds = {} as Record<string, string>;
  const menu: Record<string, { id: string; name: Localized; price: number }[]> = {};
  const tablesByOutlet: Record<string, string[]> = {};

  D.OUTLETS.forEach((o, i) => {
    const id = uuid();
    outletIds[o.key] = id;
    menu[o.key] = [];
    tablesByOutlet[o.key] = [];
    outletRows.push({ id, orgId, type: o.type, name: o.name, openingHours: o.openingHours, sortOrder: i });
    o.categories.forEach((c, ci) => {
      const categoryId = uuid();
      categoryRows.push({ id: categoryId, orgId, outletId: id, name: c.name, sortOrder: ci });
      c.products.forEach((p, pi) => {
        const pid = uuid();
        productRows.push({
          id: pid, orgId, outletId: id, categoryId, name: p.name, price: p.price, cost: r2(p.price * 0.32), vatRate: 20,
          trackStock: p.stock !== undefined, stockQty: p.stock ?? 0, lowStockThreshold: p.threshold ?? null, sortOrder: pi,
        });
        menu[o.key]!.push({ id: pid, name: p.name, price: p.price });
      });
    });
    for (let n = 1; n <= o.tables; n++) {
      const tid = uuid();
      tablesByOutlet[o.key]!.push(tid);
      tableRows.push({
        id: tid, orgId, outletId: id, label: `${o.tablePrefix}${n}`, seats: o.key === 'bar' ? 2 : 4,
        layout: { x: (n - 1) % 4, y: Math.floor((n - 1) / 4), w: 1, h: 1, shape: n % 3 === 0 ? 'square' : 'round' },
      });
    }
  });

  const spaServiceRows = D.SPA_SERVICES.map((sv, i) => ({ id: uuid(), orgId, ...sv, vatRate: 20, sortOrder: i }));
  const therapistRows = D.THERAPISTS.map((t) => ({ id: uuid(), orgId, ...t }));

  // ─── Folios, invoices, payments ──────────────────────────
  const folioRows: Insert<typeof s.folios>[] = [];
  const folioItemRows: Insert<typeof s.folioItems>[] = [];
  const invoiceRows: Insert<typeof s.invoices>[] = [];
  const invoiceLineRows: Insert<typeof s.invoiceLines>[] = [];
  const paymentRows: Insert<typeof s.payments>[] = [];
  let invoiceSeq = 0;

  for (const b of bookingRows) {
    if (b.status === 'confirmed' && b.depositAmount > 0) {
      paymentRows.push({ orgId, bookingId: b.id, amount: b.depositAmount, method: 'bank_transfer', isDeposit: true, receivedAt: b.createdAt as Date });
    }
    if (b.status !== 'checked_in' && b.status !== 'checked_out') continue;

    const folioId = uuid();
    const closed = b.status === 'checked_out';
    folioRows.push({ id: folioId, orgId, bookingId: b.id, guestId: b.guestId, status: closed ? 'closed' : 'open', openedAt: b.checkedInAt!, closedAt: b.checkedOutAt ?? null });

    const items: (Insert<typeof s.folioItems> & { amount: number; vatRate: number })[] = [{
      orgId, folioId, type: 'room', description: `Akomodim · ${b.nights} net · Dhoma ${b.roomNumber}`, quantity: b.nights,
      unitPrice: r2(b.totalAmount / b.nights), amount: b.totalAmount, vatRate: 6, postedAt: b.checkedInAt!,
    }];

    for (const n of dateRange(b.checkIn, closed ? b.checkOut : today)) {
      if (!rng.chance(0.55)) continue;
      const kind = rng.weighted(D.EXTRA_WEIGHTS);
      const postedAt = at(n, rng.int(12, 23), rng.int(0, 59));
      if (kind === 'spa') {
        const sv = rng.pick(spaServiceRows);
        items.push({ orgId, folioId, type: 'spa', description: sv.name.sq, quantity: 1, unitPrice: sv.price, amount: sv.price, vatRate: 20, outletId: outletIds.spa, postedAt });
      } else if (kind === 'minibar') {
        const m = rng.pick(D.MINIBAR);
        const q = rng.int(1, 3);
        items.push({ orgId, folioId, type: 'minibar', description: m.sq, quantity: q, unitPrice: m.price, amount: r2(m.price * q), vatRate: 20, postedAt });
      } else {
        const p = rng.pick(menu[kind]!);
        const q = rng.int(1, 4);
        items.push({ orgId, folioId, type: kind, description: p.name.sq, quantity: q, unitPrice: p.price, amount: r2(p.price * q), vatRate: 20, outletId: outletIds[kind], postedAt });
      }
    }
    folioItemRows.push(...items);

    if (closed) {
      invoiceSeq++;
      const invoiceId = uuid();
      const total = r2(items.reduce((sum, i) => sum + i.amount, 0));
      const vat = r2(items.reduce((sum, i) => sum + vatOf(i.amount, i.vatRate), 0));
      const method = D.PREPAID_SOURCES.includes(b.source!) ? 'online' : rng.weighted(D.PAYMENT_WEIGHTS);
      const nslf = rng.hex(32).toUpperCase();
      const issuedAt = b.checkedOutAt!;
      invoiceRows.push({
        id: invoiceId, orgId, number: `${invoiceSeq}/${year}`, folioId, guestId: b.guestId, buyerName: guestName(b.guestId),
        issuedAt, subtotal: r2(total - vat), vatTotal: vat, total, currency: 'EUR', paymentMethod: method, status: 'fiscalized',
        nivf: nslf, nslf: uuid(), fiscalProvider: 'mock', fiscalResponse: { mock: true },
        // MOCK verification link, not a real fiscal QR
        qrUrl: `https://efiskalizimi-app-test.tatime.gov.al/invoice-check/#/verify?iic=${nslf}&tin=${D.ORG.nipt}&crtd=${encodeURIComponent(issuedAt.toISOString())}&prc=${total.toFixed(2)}`,
        issuedBy: userIds.receptionist,
      });
      invoiceLineRows.push(...items.map((i) => ({
        orgId, invoiceId, description: i.description, quantity: i.quantity, unitPrice: i.unitPrice, vatRate: i.vatRate, amount: i.amount,
      })));
      paymentRows.push({ orgId, folioId, invoiceId, bookingId: b.id, amount: total, method, receivedAt: issuedAt, receivedBy: userIds.receptionist });
    } else if (b.paidAmount > 0) {
      paymentRows.push({ orgId, folioId, bookingId: b.id, amount: b.paidAmount, method: D.PREPAID_SOURCES.includes(b.source!) ? 'online' : 'bank_transfer', isDeposit: b.paidAmount < b.totalAmount, receivedAt: b.createdAt as Date });
    }
  }

  // ─── POS orders (last 14 days) ───────────────────────────
  const posOrderRows: (Insert<typeof s.posOrders> & { subtotal: number; day: string })[] = [];
  const posItemRows: Insert<typeof s.posOrderItems>[] = [];
  for (const day of dateRange(addDays(today, -13), addDays(today, 1))) {
    for (const o of D.OUTLETS) {
      if (!o.dailyOrders || menu[o.key]!.length === 0) continue;
      const count = rng.int(o.dailyOrders[0], o.dailyOrders[1]);
      for (let k = 0; k < count; k++) {
        const createdAt = at(day, rng.int(o.hours[0], o.hours[1]), rng.int(0, 59));
        if (createdAt > now) continue;
        const orderId = uuid();
        const lines = Array.from({ length: rng.int(1, 4) }, () => {
          const p = rng.pick(menu[o.key]!);
          return { orgId, orderId, productId: p.id, name: p.name.sq, quantity: rng.int(1, 3), unitPrice: p.price, vatRate: 20 };
        });
        const subtotal = r2(lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0));
        const isOpen = plusMinutes(createdAt, 60) > now;
        posOrderRows.push({
          id: orderId, orgId, outletId: outletIds[o.key]!, tableId: rng.pick(tablesByOutlet[o.key]!), status: isOpen ? 'open' : 'paid',
          subtotal, discount: 0, total: subtotal, paymentMethod: isOpen ? null : rng.weighted({ cash: 55, card: 45 }),
          covers: rng.int(1, 4), openedBy: userIds.pos, createdAt, paidAt: isOpen ? null : plusMinutes(createdAt, rng.int(15, 70)), day,
        });
        posItemRows.push(...lines);
      }
    }
  }
  const suspicious = posOrderRows.filter((o) => o.outletId === outletIds.bar && o.status === 'paid' && o.day === yesterday).at(-1);
  if (suspicious) {
    suspicious.discount = r2(suspicious.subtotal * 0.4);
    suspicious.total = r2(suspicious.subtotal - suspicious.discount);
    suspicious.notes = 'Zbritje manuale 40%';
  }

  // ─── Spa appointments (±7 days) ──────────────────────────
  const spaRows: (Insert<typeof s.spaAppointments> & { day: string })[] = [];
  const inHouse = (d: string) =>
    bookingRows.filter((b) => ['checked_in', 'checked_out', 'confirmed'].includes(b.status) && b.checkIn <= d && b.checkOut > d);
  for (const day of dateRange(addDays(today, -7), addDays(today, 8))) {
    const house = inHouse(day);
    for (const th of therapistRows) {
      let m = 600;
      while (m < 1140) {
        if (!rng.chance(0.42)) {
          m += 60;
          continue;
        }
        const sv = rng.pick(spaServiceRows);
        const startsAt = at(day, Math.floor(m / 60), m % 60);
        const endsAt = plusMinutes(startsAt, sv.durationMin);
        const stay = house.length > 0 && rng.chance(0.8) ? rng.pick(house) : null;
        const past = endsAt < now;
        spaRows.push({
          orgId, serviceId: sv.id, therapistId: th.id, guestId: stay?.guestId ?? null, bookingId: stay?.id ?? null,
          guestName: stay ? guestName(stay.guestId) : rng.pick(D.WALKIN_NAMES), startsAt, endsAt,
          status: past ? (rng.chance(0.05) ? 'no_show' : 'completed') : rng.chance(0.6) ? 'confirmed' : 'booked',
          price: sv.price, chargedToFolio: past && stay !== null, day,
        });
        m += sv.durationMin + 15;
      }
    }
  }

  // ─── Cash shifts (last 7 days) ───────────────────────────
  const shiftRows: Insert<typeof s.cashShifts>[] = [];
  let badShiftId = '';
  for (let i = 7; i >= 1; i--) {
    const day = addDays(today, -i);
    for (const [open, close] of [[7, 15], [15, 23]] as const) {
      const id = uuid();
      const expected = rng.int(350, 1400);
      const isBad = i === 1 && open === 15;
      if (isBad) badShiftId = id;
      const counted = isBad ? expected - 40 : expected;
      shiftRows.push({
        id, orgId, userId: userIds.receptionist, openedAt: at(day, open), closedAt: at(day, close), openingCash: 200,
        expectedCash: expected + 200, countedCash: counted + 200, difference: counted - expected, notes: isBad ? 'Mungojnë 40 € në arkë' : null,
      });
    }
  }

  // ─── Expenses (last 60 days, ALL) ────────────────────────
  const expenseRows: Insert<typeof s.expenses>[] = Array.from({ length: 60 }, () => {
    const e = rng.pickWeighted(D.EXPENSES, (x) => x.weight);
    const amount = Math.round(rng.int(e.min, e.max) / 10) * 10;
    const ocr = rng.chance(0.6);
    return {
      orgId, supplierName: e.supplier, supplierNipt: e.nipt, invoiceNumber: `${rng.int(100, 9999)}/${year}`, category: e.category,
      department: e.department, amount, vatAmount: vatOf(amount, 20), currency: 'ALL', expenseDate: addDays(today, -rng.int(0, 59)),
      paymentMethod: rng.weighted({ cash: 50, bank_transfer: 50 }), createdBy: userIds.accountant,
      ocrData: ocr ? { source: 'ai_ocr', supplier: e.supplier, total: amount } : null,
      ocrConfidence: ocr ? r2(0.88 + rng.next() * 0.11) : null,
    };
  });

  // ─── Inbox ───────────────────────────────────────────────
  const conversationRows: Insert<typeof s.conversations>[] = [];
  const messageRows: Insert<typeof s.messages>[] = [];
  for (const c of D.CONVERSATIONS) {
    const conversationId = uuid();
    const last = c.messages[c.messages.length - 1]!;
    conversationRows.push({
      id: conversationId, orgId, channel: c.channel, externalId: c.contactHandle, contactName: c.contactName,
      contactHandle: c.contactHandle, language: c.language, status: c.status, aiEnabled: c.status !== 'human_handling',
      assignedTo: c.status === 'human_handling' ? userIds.receptionist : null, unreadCount: c.unread,
      lastMessageAt: minutesAgo(last.minutesAgo), lastMessagePreview: last.body.slice(0, 120), createdAt: minutesAgo(c.messages[0]!.minutesAgo),
    });
    c.messages.forEach((m, idx) => {
      const createdAt = new Date(minutesAgo(m.minutesAgo).getTime() + idx * 1000);
      messageRows.push({
        orgId, conversationId, direction: m.author === 'guest' ? 'inbound' : 'outbound', author: m.author,
        authorUserId: m.author === 'staff' ? userIds.receptionist : null, body: m.body,
        attachments: m.attachment ? [{ type: 'image', url: m.attachment, name: 'pasaporta.jpg' }] : [],
        aiMeta: m.author === 'ai' ? { model: 'mock', confidence: 0.96 } : null, createdAt, deliveredAt: createdAt,
      });
    });
  }
  const templateRows: Insert<typeof s.messageTemplates>[] = D.TEMPLATES.map((t) => ({ orgId, ...t }));
  const callRows: Insert<typeof s.callLogs>[] = D.CALLS.map((c) => ({
    orgId, provider: 'mock', externalId: `call_${rng.hex(12)}`, fromNumber: c.from, toNumber: D.ORG.phone, language: c.language,
    durationSec: c.durationSec, outcome: c.outcome, summary: c.summary, transcript: c.transcript,
    transferredTo: c.transferredTo ?? null, createdAt: minutesAgo(c.minutesAgo),
  }));

  // ─── Room status & housekeeping ──────────────────────────
  const inHouseNow = bookingRows.filter((b) => b.status === 'checked_in' && b.roomId);
  const departing = new Set(inHouseNow.filter((b) => b.checkOut === today).map((b) => b.roomId));
  const stayover = new Set(inHouseNow.filter((b) => b.checkOut > today).map((b) => b.roomId));
  const arriving = new Set(bookingRows.filter((b) => b.status === 'confirmed' && b.checkIn === today && b.roomId).map((b) => b.roomId));
  const hkRows: Insert<typeof s.housekeepingTasks>[] = [];
  for (const room of roomRows) {
    if (room.number === D.OUT_OF_ORDER_ROOM) room.status = 'out_of_order';
    else if (departing.has(room.id)) room.status = 'dirty';
    else if (stayover.has(room.id)) room.status = rng.chance(0.45) ? 'dirty' : 'clean';
    else room.status = rng.chance(0.5) ? 'inspected' : 'clean';

    if (departing.has(room.id)) {
      hkRows.push({
        orgId, roomId: room.id, type: 'checkout_clean', status: 'open', priority: arriving.has(room.id) ? 'urgent' : 'high',
        dueDate: today, assignedTo: userIds.housekeeping, notes: arriving.has(room.id) ? 'Mbërritje sot: gati deri në 14:00' : null,
      });
    } else if (stayover.has(room.id) && room.status === 'dirty') {
      hkRows.push({ orgId, roomId: room.id, type: 'stayover', status: rng.chance(0.3) ? 'in_progress' : 'open', priority: 'normal', dueDate: today, assignedTo: userIds.housekeeping });
    }
  }
  const roomId = (n: string) => roomRows.find((r) => r.number === n)!.id;
  const maintenanceRows: Insert<typeof s.maintenanceTickets>[] = [
    { orgId, roomId: roomId(D.OUT_OF_ORDER_ROOM), title: 'Kondicioneri nuk ftoh', description: 'Teknikut i duhet një pjesë këmbimi, pritet nesër.', status: 'in_progress', priority: 'high', blocksRoom: true, reportedBy: userIds.housekeeping, assignedTo: userIds.manager },
    { orgId, roomId: roomId('204'), title: 'Llamba e banjës është djegur', status: 'open', priority: 'low', reportedBy: userIds.housekeeping },
    { orgId, roomId: roomId('305'), title: 'Rrjedh rubineti i lavamanit', status: 'done', priority: 'normal', reportedBy: userIds.receptionist, resolvedAt: minutesAgo(1300) },
  ];

  // ─── Alerts ──────────────────────────────────────────────
  const aperol = productRows.find((p) => (p.name as Localized).en === 'Aperol Spritz')!;
  const alertRows: Insert<typeof s.alerts>[] = [
    { orgId, type: 'cash_difference', severity: 'critical', title: 'Diferencë arke: −40 € në turnin e mbrëmjes', body: 'Turni 15:00–23:00 i djeshëm u mbyll me 40 € më pak se sa pritej.', entityType: 'cash_shift', entityId: badShiftId, data: { difference: -40 }, createdAt: at(yesterday, 23, 5) },
    ...(suspicious ? [{ orgId, type: 'unusual_discount', severity: 'warning' as const, title: 'Zbritje e pazakontë 40% në Bar Laguna', body: 'Rregulli i hotelit lejon deri në 15% pa miratim.', entityType: 'pos_order', entityId: suspicious.id!, data: { percent: 40, amount: suspicious.discount }, createdAt: suspicious.paidAt ?? minutesAgo(600) }] : []),
    { orgId, type: 'low_stock', severity: 'warning', title: 'Aperol po mbaron: 6 shishe', body: 'Nën pragun prej 10. Porositni nga furnitori.', entityType: 'product', entityId: aperol.id!, createdAt: minutesAgo(180) },
    { orgId, type: 'maintenance', severity: 'info', title: `Dhoma ${D.OUT_OF_ORDER_ROOM} jashtë shërbimit`, body: 'Kondicioneri: pritet pjesa e këmbimit.', entityType: 'room', entityId: roomId(D.OUT_OF_ORDER_ROOM), createdAt: minutesAgo(900) },
    { orgId, type: 'pricing_suggestion', severity: 'info', title: 'Kërkesë e lartë për fundjavën', body: 'Rritni çmimet 10% për Deluxe me pamje nga deti: 85% e dhomave janë zënë.', data: { roomType: 'DLX', changePct: 10 }, createdAt: at(today, 7, 0) },
  ];

  // ─── Channel mappings ────────────────────────────────────
  const mappingRows: Insert<typeof s.channelMappings>[] = typeRows.flatMap((t) =>
    ['booking_com', 'expedia', ...(t.code === 'VIL' || t.code === 'JS' ? ['airbnb'] : [])].map((channel) => ({
      orgId, provider: 'channex' as const, channel, roomTypeId: t.id, externalRoomId: `mock-${channel}-${t.code}`,
      externalRatePlanId: `mock-rate-${t.code}-BAR`, icalExportToken: rng.hex(24), lastSyncAt: minutesAgo(rng.int(2, 30)),
    })),
  );

  // ─── Owner morning report ────────────────────────────────
  const revenueOn = (d: string) => {
    const nights = bookingRows.filter((b) => (b.status === 'checked_in' || b.status === 'checked_out') && b.checkIn <= d && b.checkOut > d);
    const rooms = nights.reduce((sum, b) => sum + rateOf(b.typeCode, d), 0);
    const fb = posOrderRows.filter((o) => o.status === 'paid' && o.day === d).reduce((sum, o) => sum + (o.total ?? 0), 0);
    const spa = spaRows.filter((a) => a.status === 'completed' && a.day === d).reduce((sum, a) => sum + a.price, 0);
    return { occupied: nights.length, rooms, fb, spa, total: rooms + fb + spa };
  };
  const y = revenueOn(yesterday);
  const lastWeek = revenueOn(addDays(yesterday, -7));
  const pct = lastWeek.total > 0 ? Math.round(((y.total - lastWeek.total) / lastWeek.total) * 100) : 0;
  const occupancy = Math.round((y.occupied / roomRows.length) * 100);
  const todayArrivals = bookingRows.filter((b) => b.checkIn === today && b.status === 'confirmed');
  const vipArrivals = todayArrivals.filter((b) => guestById.get(b.guestId)?.isVip).length;
  const eur = (n: number) => `${Math.round(n).toLocaleString('de-DE')} €`;
  const reportRow: Insert<typeof s.ownerReports> = {
    orgId, reportDate: today, kind: 'morning', sentVia: 'whatsapp', sentAt: at(today, 7, 30),
    content: {
      headline: `Dje: ${eur(y.total)} · ${occupancy}% plot`,
      story: `Mirëmëngjes, Dritan. Dje fituat ${eur(y.total)}, ${Math.abs(pct)}% ${pct >= 0 ? 'më shumë' : 'më pak'} se e njëjta ditë e javës së kaluar. Hoteli ishte ${occupancy}% plot. Sot mbërrijnë ${todayArrivals.length} rezervime${vipArrivals ? `, prej tyre ${vipArrivals} VIP` : ''}. Një diferencë arke prej 40 € kërkon vëmendjen tuaj.`,
      metrics: {
        revenue: r2(y.total), roomRevenue: r2(y.rooms), fbRevenue: r2(y.fb), spaRevenue: r2(y.spa), occupancy,
        adr: y.occupied ? r2(y.rooms / y.occupied) : 0, revpar: r2(y.rooms / roomRows.length), arrivalsToday: todayArrivals.length, changePct: pct,
      },
      actions: ['Kontrolloni diferencën e arkës në turnin e mbrëmjes', 'Aperol po mbaron në Bar Laguna', 'Rritni çmimet 10% për fundjavën: kërkesa është e lartë'],
    },
  };

  const auditRows: Insert<typeof s.auditLogs>[] = [
    ...(suspicious ? [{ orgId, userId: userIds.pos, action: 'pos.discount_applied', entityType: 'pos_order', entityId: suspicious.id!, meta: { percent: 40 }, createdAt: suspicious.paidAt ?? minutesAgo(600) }] : []),
    { orgId, userId: userIds.receptionist, action: 'cash_shift.closed', entityType: 'cash_shift', entityId: badShiftId, meta: { difference: -40 }, createdAt: at(yesterday, 23, 2) },
    { orgId, userId: userIds.manager, action: 'room.out_of_order', entityType: 'room', entityId: roomId(D.OUT_OF_ORDER_ROOM), meta: {}, createdAt: minutesAgo(900) },
  ];

  // ─── Insert (dependency order) ───────────────────────────
  await db.insert(s.organizations).values(orgRow);
  await insertMany(s.memberships, membershipRows);
  await insertMany(s.orgModules, moduleRows);
  await insertMany(s.integrations, integrationRows);
  await insertMany(s.roomTypes, typeRows);
  await insertMany(s.rooms, roomRows);
  await insertMany(s.dailyRates, rateRows);
  await insertMany(s.guests, guestRows);
  await insertMany(s.bookings, bookingRows);
  await insertMany(s.folios, folioRows);
  await insertMany(s.folioItems, folioItemRows);
  await insertMany(s.outlets, outletRows);
  await insertMany(s.productCategories, categoryRows);
  await insertMany(s.products, productRows);
  await insertMany(s.posTables, tableRows);
  await insertMany(s.spaServices, spaServiceRows);
  await insertMany(s.spaTherapists, therapistRows);
  await insertMany(s.posOrders, posOrderRows);
  await insertMany(s.posOrderItems, posItemRows);
  await insertMany(s.spaAppointments, spaRows);
  await insertMany(s.invoices, invoiceRows);
  await insertMany(s.invoiceLines, invoiceLineRows);
  await insertMany(s.cashShifts, shiftRows);
  await insertMany(s.payments, paymentRows);
  await insertMany(s.expenses, expenseRows);
  await insertMany(s.conversations, conversationRows);
  await insertMany(s.messages, messageRows);
  await insertMany(s.messageTemplates, templateRows);
  await insertMany(s.callLogs, callRows);
  await insertMany(s.housekeepingTasks, hkRows);
  await insertMany(s.maintenanceTickets, maintenanceRows);
  await insertMany(s.alerts, alertRows);
  await insertMany(s.channelMappings, mappingRows);
  await db.insert(s.ownerReports).values(reportRow);
  await insertMany(s.auditLogs, auditRows);

  console.table({
    rooms: roomRows.length, guests: guestRows.length, bookings: bookingRows.length, invoices: invoiceRows.length,
    posOrders: posOrderRows.length, spaAppointments: spaRows.length, conversations: conversationRows.length,
  });
  console.log('Demo logins (password = DEMO_PASSWORD):');
  for (const u of D.USERS) console.log(`  ${u.role ?? 'super-admin'}: ${u.email}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
