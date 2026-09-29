import 'server-only';
import { and, asc, eq, ilike, or } from 'drizzle-orm';
import { db } from '@/db';
import { bookings, folios, guests, roomTypes, rooms } from '@/db/schema';
import type { ModuleKey, Role } from '@/lib/auth/types';
import type { OrgContext } from '@/lib/auth/session';
import { addDays, todayIn } from '@/lib/dates';
import { assignRoom, cancelBooking, checkInBooking, checkOutBooking, confirmBooking, createBooking, markNoShow, postCharge, recordPayment, updateGuest } from '@/server/actions/bookings';
import { moveBooking, setRates } from '@/server/actions/calendar';
import { resolveAlert, applyPricingSuggestion } from '@/server/actions/alerts';
import { saveExpense } from '@/server/actions/expenses';
import { sendStaffMessage } from '@/server/actions/inbox';
import { cancelInvoice, fiscalizeInvoiceAction, issueInvoice } from '@/server/actions/invoices';
import { changeRoomStatus, createHousekeepingTask, createMaintenanceTicket } from '@/server/actions/operations';
import { bookAppointment, setAppointmentStatus } from '@/server/actions/spa';
import { getChannelBreakdown, getExpensesByDept, getOccupancyByDay, getOpenAlerts, getOutletSales, getPeriodStats, getPricingSuggestions, getTopGuests } from '@/server/queries/analytics';
import { getBookingDetail, listBookings, type BookingView } from '@/server/queries/bookings';
import { listExpenses } from '@/server/queries/expenses';
import { listGuests } from '@/server/queries/guests';
import { listConversations } from '@/server/queries/inbox';
import { listInvoices } from '@/server/queries/invoices';
import { getOperations } from '@/server/queries/operations';
import { getSpa } from '@/server/queries/spa';
import { quoteStay } from '@/server/services/stay';

export type AgentToolDef = {
  name: string;
  kind: 'read' | 'write';
  /** write only: 'safe' runs immediately in auto mode; 'confirm' always waits for the human. */
  risk?: 'safe' | 'confirm';
  roles: readonly Role[];
  module?: ModuleKey;
  label: { sq: string; en: string };
  description: string;
  parameters: Record<string, unknown>;
  summarize?: (a: Record<string, unknown>, locale: 'sq' | 'en') => string;
  run: (ctx: OrgContext, a: Record<string, unknown>) => Promise<unknown>;
};

const ALL: readonly Role[] = ['owner', 'manager', 'receptionist', 'housekeeping', 'pos', 'spa', 'accountant'];
const FRONT: readonly Role[] = ['owner', 'manager', 'receptionist'];
const HK: readonly Role[] = ['owner', 'manager', 'receptionist', 'housekeeping'];
const FIN: readonly Role[] = ['owner', 'manager', 'accountant'];
const MGR: readonly Role[] = ['owner', 'manager'];
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v));
const obj = (props: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties: props, ...(required.length ? { required } : {}), additionalProperties: false });
const S = { type: 'string' } as const;
const N = { type: 'number' } as const;
const B = { type: 'boolean' } as const;
const DATE = { type: 'string', description: 'YYYY-MM-DD' } as const;

/** Server actions return {ok,error}; the operations actions throw. Normalise both into a thrown Error. */
const HINTS: Record<string, string> = {
  badStatus: 'Not allowed in the current booking status (for example it is already confirmed, checked in or cancelled). Read the booking with get_booking first.',
  soldOut: 'No room of that type is free for those dates. Try check_availability for other types or dates.',
  roomTaken: 'That room is already taken for those dates. Pick another room or use auto-assign.',
  roomNotReady: 'The room is not clean/inspected yet. Set it clean first or choose another room.',
  balanceDue: 'The guest still owes money. Record a payment first (or ask a manager to force checkout).',
  tooEarly: 'The arrival date has not come yet.',
  notConfirmed: 'Confirm the booking before checking in.',
  forbidden: 'This role is not allowed to do that.',
  minStay: 'Minimum stay not met for those dates.',
  closed: 'One of those nights is closed for sale.',
  occupancy: 'Too many guests for that room type.',
  pastDate: 'That date is in the past.',
  notFound: 'Nothing found with that reference.',
  invalid: 'One of the values is invalid (check formats: dates YYYY-MM-DD, amounts as numbers).',
  guestRequired: 'Provide guest details (first, last) or a guest_id.',
  duplicate: 'That already exists.',
};

async function act<T>(p: Promise<{ ok: boolean; data?: T; error?: string }> | Promise<void>): Promise<T | { done: true }> {
  const r = (await p) as { ok?: boolean; data?: T; error?: string } | undefined;
  if (r && typeof r === 'object' && 'ok' in r) {
    if (!r.ok) throw new Error(HINTS[r.error ?? ''] ?? r.error ?? 'failed');
    return (r.data ?? { done: true }) as T;
  }
  return { done: true };
}

async function bookingByCode(ctx: OrgContext, ref: string) {
  const code = ref.trim();
  const [b] = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.orgId, ctx.org.id), uuidRe.test(code) ? eq(bookings.id, code) : eq(bookings.code, code.toUpperCase())))
    .limit(1);
  if (!b) throw new Error(`No booking with code ${code}. Use find_bookings to search.`);
  return b;
}
async function roomByNumber(ctx: OrgContext, num: string) {
  const [r] = await db.select().from(rooms).where(and(eq(rooms.orgId, ctx.org.id), eq(rooms.number, num.trim()))).limit(1);
  if (!r) throw new Error(`No room ${num}. Use list_rooms.`);
  return r;
}
async function typeByRef(ctx: OrgContext, ref: string) {
  const v = ref.trim();
  const [t] = await db
    .select()
    .from(roomTypes)
    .where(and(eq(roomTypes.orgId, ctx.org.id), uuidRe.test(v) ? eq(roomTypes.id, v) : ilike(roomTypes.code, v)))
    .limit(1);
  if (!t) throw new Error(`No room type ${ref}. Use list_room_types.`);
  return t;
}
const fd = (o: Record<string, string | boolean | undefined>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== '') f.set(k, v === true ? 'on' : String(v));
  return f;
};
const t2 = (l: 'sq' | 'en', sq: string, en: string) => (l === 'en' ? en : sq);

export const AGENT_TOOLS: AgentToolDef[] = [
  /* ───────────── READ ───────────── */
  { name: 'list_room_types', kind: 'read', roles: ALL, label: { sq: 'Lexoj llojet e dhomave', en: 'Reading room types' }, description: 'Room types with id, code, name, base price and max guests.', parameters: obj({}),
    run: async (ctx) => (await db.select().from(roomTypes).where(and(eq(roomTypes.orgId, ctx.org.id), eq(roomTypes.isActive, true))).orderBy(asc(roomTypes.sortOrder))).map((t) => ({ id: t.id, code: t.code, name: t.name.sq, basePrice: t.basePrice, maxGuests: t.maxOccupancy })) },
  { name: 'list_rooms', kind: 'read', roles: HK, module: 'pms', label: { sq: 'Kontrolloj dhomat', en: 'Checking rooms' }, description: 'All rooms with number, status (clean/dirty/inspected/out_of_order), current occupant and open tasks.', parameters: obj({}),
    run: async (ctx) => { const d = await getOperations(ctx); return d.rooms.map((r) => ({ number: r.number, floor: r.floor, status: r.status, occupied: Boolean(r.occupant), checkOut: r.occupant?.checkOut ?? null, openTasks: r.openTasks })); } },
  { name: 'find_bookings', kind: 'read', roles: FRONT, module: 'pms', label: { sq: 'Kërkoj rezervimet', en: 'Searching bookings' }, description: 'Search bookings by guest name, code, phone or email, or list a view for today.', parameters: obj({ query: S, view: { type: 'string', enum: ['arrivals', 'inhouse', 'departures', 'upcoming', 'all'] } }),
    run: async (ctx, a) => (await listBookings(ctx, (str(a.view) || 'all') as BookingView, str(a.query))).slice(0, 20).map((r) => ({ code: r.code, guest: `${r.firstName} ${r.lastName}`, room: r.roomNumber, checkIn: r.checkIn, checkOut: r.checkOut, status: r.status, source: r.source, total: r.total, balance: r.balance })) },
  { name: 'get_booking', kind: 'read', roles: FRONT, module: 'pms', label: { sq: 'Hap rezervimin', en: 'Opening the booking' }, description: 'Full booking detail incl. folio charges and payments.', parameters: obj({ code: S }, ['code']),
    run: async (ctx, a) => { const b = await bookingByCode(ctx, str(a.code)); return getBookingDetail(ctx, b.id); } },
  { name: 'check_availability', kind: 'read', roles: FRONT, module: 'pms', label: { sq: 'Kontrolloj disponueshmërinë', en: 'Checking availability' }, description: 'Live availability and exact total per room type for a stay.', parameters: obj({ checkIn: DATE, checkOut: DATE, adults: N }, ['checkIn', 'checkOut']),
    run: async (ctx, a) => { const types = await db.select().from(roomTypes).where(and(eq(roomTypes.orgId, ctx.org.id), eq(roomTypes.isActive, true))); const out = []; for (const t of types) { const q = await quoteStay(db, { orgId: ctx.org.id, roomTypeId: t.id, checkIn: str(a.checkIn), checkOut: str(a.checkOut), guests: Number(a.adults) || 2, enforceRules: false }); out.push(q.ok ? { type: t.code, id: t.id, available: q.available, total: q.total, nights: q.nights, warnings: q.warnings } : { type: t.code, id: t.id, available: false, reason: q.reason }); } return out; } },
  { name: 'find_guests', kind: 'read', roles: FRONT, module: 'pms', label: { sq: 'Kërkoj mysafirët', en: 'Searching guests' }, description: 'Search guests by name, email or phone.', parameters: obj({ query: S }, ['query']),
    run: async (ctx, a) => (await listGuests(ctx, str(a.query))).slice(0, 15).map((g) => ({ id: g.id, name: `${g.firstName} ${g.lastName}`, email: g.email, phone: g.phone, vip: g.isVip, stays: g.stays, spent: g.value })) },
  { name: 'get_kpis', kind: 'read', roles: FIN, label: { sq: 'Llogaris treguesit', en: 'Calculating KPIs' }, description: 'Revenue, occupancy, ADR, RevPAR, bookings for a date range.', parameters: obj({ from: DATE, to: DATE }, ['from', 'to']), run: (ctx, a) => getPeriodStats(ctx, str(a.from), str(a.to)) },
  { name: 'revenue_by_channel', kind: 'read', roles: FIN, label: { sq: 'Analizoj kanalet', en: 'Analysing channels' }, description: 'Revenue and commission per booking source.', parameters: obj({ from: DATE, to: DATE }, ['from', 'to']), run: (ctx, a) => getChannelBreakdown(ctx, str(a.from), str(a.to)) },
  { name: 'sales_by_outlet', kind: 'read', roles: FIN, label: { sq: 'Shikoj shitjet', en: 'Reading sales' }, description: 'POS sales per outlet.', parameters: obj({ from: DATE, to: DATE }, ['from', 'to']), run: (ctx, a) => getOutletSales(ctx, str(a.from), str(a.to)) },
  { name: 'expenses_summary', kind: 'read', roles: FIN, label: { sq: 'Shikoj shpenzimet', en: 'Reading expenses' }, description: 'Expenses by department.', parameters: obj({ from: DATE, to: DATE }, ['from', 'to']), run: (ctx, a) => getExpensesByDept(ctx, str(a.from), str(a.to)) },
  { name: 'list_expenses', kind: 'read', roles: FIN, module: 'expenses', label: { sq: 'Lexoj shpenzimet', en: 'Listing expenses' }, description: 'Expense rows for a month (YYYY-MM).', parameters: obj({ month: S, query: S }, ['month']), run: async (ctx, a) => (await listExpenses(ctx, str(a.month), 'all', str(a.query))).slice(0, 30) },
  { name: 'occupancy_forecast', kind: 'read', roles: FRONT.concat('accountant'), label: { sq: 'Parashikoj pushtimin', en: 'Forecasting occupancy' }, description: 'Occupied rooms per day for the next N days.', parameters: obj({ days: N }, ['days']),
    run: async (ctx, a) => { const days = Math.min(60, Math.max(1, Number(a.days) || 14)); const today = todayIn(ctx.org.timezone); const d = await getOccupancyByDay(ctx, today, days); const total = d.reduce((s, t) => s + t.rooms, 0); return { totalRooms: total, daily: Array.from({ length: days }, (_, i) => { const occ = d.reduce((s, t) => s + (t.days[i]?.occupied ?? 0), 0); return { date: addDays(today, i), occupied: occ, pct: total ? Math.round((occ / total) * 100) : 0 }; }) }; } },
  { name: 'top_guests', kind: 'read', roles: FIN, label: { sq: 'Gjej mysafirët më të mirë', en: 'Finding top guests' }, description: 'Best guests by lifetime spend.', parameters: obj({}), run: (ctx) => getTopGuests(ctx, 10) },
  { name: 'open_alerts', kind: 'read', roles: FRONT.concat('accountant'), label: { sq: 'Shikoj alarmet', en: 'Checking alerts' }, description: 'Unresolved alerts with ids.', parameters: obj({}), run: (ctx) => getOpenAlerts(ctx) },
  { name: 'pricing_suggestions', kind: 'read', roles: MGR, label: { sq: 'Analizoj çmimet', en: 'Analysing pricing' }, description: 'Rule-based price suggestions for the next 3 weeks.', parameters: obj({}), run: (ctx) => getPricingSuggestions(ctx, todayIn(ctx.org.timezone)) },
  { name: 'list_invoices', kind: 'read', roles: FIN.concat('receptionist'), module: 'invoicing', label: { sq: 'Lexoj faturat', en: 'Listing invoices' }, description: 'Invoices, optionally by status.', parameters: obj({ status: { type: 'string', enum: ['all', 'fiscalized', 'issued', 'failed', 'cancelled'] }, query: S }), run: async (ctx, a) => (await listInvoices(ctx, str(a.status) || 'all', str(a.query))).slice(0, 25) },
  { name: 'list_conversations', kind: 'read', roles: FRONT, module: 'inbox', label: { sq: 'Lexoj mesazhet', en: 'Reading messages' }, description: 'Inbox conversations with ids and status.', parameters: obj({ filter: { type: 'string', enum: ['all', 'needs_human', 'ai_handling', 'human_handling', 'resolved'] } }), run: async (ctx, a) => (await listConversations(ctx, (str(a.filter) || 'needs_human') as never)).slice(0, 15) },
  { name: 'spa_schedule', kind: 'read', roles: FRONT.concat('spa'), module: 'spa', label: { sq: 'Shikoj orarin e spa-s', en: 'Reading spa schedule' }, description: 'Spa services, therapists and appointments for a date.', parameters: obj({ date: DATE }, ['date']), run: (ctx, a) => getSpa(ctx, str(a.date), 'sq') },

  /* ───────────── WRITE ───────────── */
  { name: 'create_booking', kind: 'write', risk: 'safe', roles: FRONT, module: 'pms', label: { sq: 'Krijoj rezervimin', en: 'Creating the booking' },
    description: 'Create a booking. Use room_type (code or id) and optionally room_number. Provide guest_id OR guest {first,last,email?,phone?}.',
    parameters: obj({ room_type: S, room_number: S, checkIn: DATE, checkOut: DATE, adults: N, children: N, source: { type: 'string', enum: ['direct', 'phone', 'walk_in', 'whatsapp', 'instagram', 'messenger', 'booking_com', 'airbnb'] }, status: { type: 'string', enum: ['confirmed', 'tentative'] }, guest_id: S, guest: obj({ first: S, last: S, email: S, phone: S, nationality: S }), notes: S }, ['room_type', 'checkIn', 'checkOut']),
    summarize: (a, l) => t2(l, `Rezervim ${str(a.checkIn)} → ${str(a.checkOut)}, ${str(a.room_type)}${a.room_number ? ` dhoma ${str(a.room_number)}` : ''}, për ${(a.guest as { first?: string; last?: string } | undefined)?.first ?? ''} ${(a.guest as { last?: string } | undefined)?.last ?? str(a.guest_id)}`, `Booking ${str(a.checkIn)} → ${str(a.checkOut)}, ${str(a.room_type)}${a.room_number ? ` room ${str(a.room_number)}` : ''}, for ${(a.guest as { first?: string; last?: string } | undefined)?.first ?? ''} ${(a.guest as { last?: string } | undefined)?.last ?? str(a.guest_id)}`),
    run: async (ctx, a) => { const type = await typeByRef(ctx, str(a.room_type)); const g = (a.guest ?? {}) as Record<string, string>; const room = a.room_number ? await roomByNumber(ctx, str(a.room_number)) : null; return act(createBooking({ roomTypeId: type.id, roomId: room?.id, autoAssign: !room, checkIn: str(a.checkIn), checkOut: str(a.checkOut), adults: Number(a.adults) || 2, children: Number(a.children) || 0, source: str(a.source) || 'phone', status: str(a.status) || 'confirmed', notes: str(a.notes) || undefined, ...(a.guest_id ? { guestId: str(a.guest_id) } : { guest: { firstName: g.first ?? g.firstName, lastName: g.last ?? g.lastName, email: g.email, phone: g.phone, nationality: g.nationality } }) })); } },
  { name: 'confirm_booking', kind: 'write', risk: 'safe', roles: FRONT, module: 'pms', label: { sq: 'Konfirmoj rezervimin', en: 'Confirming the booking' }, description: 'Confirm a tentative booking.', parameters: obj({ code: S }, ['code']), summarize: (a, l) => t2(l, `Konfirmo rezervimin ${str(a.code)}`, `Confirm booking ${str(a.code)}`), run: async (ctx, a) => act(confirmBooking((await bookingByCode(ctx, str(a.code))).id)) },
  { name: 'check_in', kind: 'write', risk: 'safe', roles: FRONT, module: 'pms', label: { sq: 'Regjistroj hyrjen', en: 'Checking the guest in' }, description: 'Check a guest in (room must be clean).', parameters: obj({ code: S }, ['code']), summarize: (a, l) => t2(l, `Regjistro hyrjen për ${str(a.code)}`, `Check in ${str(a.code)}`), run: async (ctx, a) => act(checkInBooking((await bookingByCode(ctx, str(a.code))).id)) },
  { name: 'check_out', kind: 'write', risk: 'safe', roles: FRONT, module: 'pms', label: { sq: 'Regjistroj daljen', en: 'Checking the guest out' }, description: 'Check a guest out. Fails if a balance is due (never use force unless the manager asked).', parameters: obj({ code: S, force: B }, ['code']), summarize: (a, l) => t2(l, `Regjistro daljen për ${str(a.code)}${a.force ? ' (me borxh)' : ''}`, `Check out ${str(a.code)}${a.force ? ' (with balance due)' : ''}`), run: async (ctx, a) => act(checkOutBooking({ bookingId: (await bookingByCode(ctx, str(a.code))).id, force: a.force === true })) },
  { name: 'cancel_booking', kind: 'write', risk: 'confirm', roles: FRONT, module: 'pms', label: { sq: 'Anuloj rezervimin', en: 'Cancelling the booking' }, description: 'Cancel a tentative/confirmed booking with a reason.', parameters: obj({ code: S, reason: S }, ['code', 'reason']), summarize: (a, l) => t2(l, `ANULO rezervimin ${str(a.code)}: ${str(a.reason)}`, `CANCEL booking ${str(a.code)}: ${str(a.reason)}`), run: async (ctx, a) => act(cancelBooking({ bookingId: (await bookingByCode(ctx, str(a.code))).id, reason: str(a.reason) })) },
  { name: 'mark_no_show', kind: 'write', risk: 'confirm', roles: FRONT, module: 'pms', label: { sq: 'Shënoj “nuk erdhi”', en: 'Marking no-show' }, description: 'Mark a booking as no-show.', parameters: obj({ code: S }, ['code']), summarize: (a, l) => t2(l, `Shëno “nuk erdhi” ${str(a.code)}`, `Mark no-show ${str(a.code)}`), run: async (ctx, a) => act(markNoShow((await bookingByCode(ctx, str(a.code))).id)) },
  { name: 'move_booking', kind: 'write', risk: 'safe', roles: FRONT, module: 'calendar', label: { sq: 'Zhvendos rezervimin', en: 'Moving the booking' }, description: 'Change room and/or dates of a booking.', parameters: obj({ code: S, room_number: S, checkIn: DATE, checkOut: DATE }, ['code']), summarize: (a, l) => t2(l, `Zhvendos ${str(a.code)}${a.room_number ? ` në dhomën ${str(a.room_number)}` : ''}${a.checkIn ? ` ${str(a.checkIn)}→${str(a.checkOut)}` : ''}`, `Move ${str(a.code)}${a.room_number ? ` to room ${str(a.room_number)}` : ''}${a.checkIn ? ` ${str(a.checkIn)}→${str(a.checkOut)}` : ''}`),
    run: async (ctx, a) => { const b = await bookingByCode(ctx, str(a.code)); const room = a.room_number ? await roomByNumber(ctx, str(a.room_number)) : null; return act(moveBooking({ bookingId: b.id, roomId: room?.id, checkIn: str(a.checkIn) || undefined, checkOut: str(a.checkOut) || undefined })); } },
  { name: 'assign_room', kind: 'write', risk: 'safe', roles: FRONT, module: 'pms', label: { sq: 'Caktoj dhomën', en: 'Assigning the room' }, description: 'Assign a room to a booking.', parameters: obj({ code: S, room_number: S }, ['code', 'room_number']), summarize: (a, l) => t2(l, `Cakto dhomën ${str(a.room_number)} për ${str(a.code)}`, `Assign room ${str(a.room_number)} to ${str(a.code)}`), run: async (ctx, a) => act(assignRoom({ bookingId: (await bookingByCode(ctx, str(a.code))).id, roomId: (await roomByNumber(ctx, str(a.room_number))).id })) },
  { name: 'record_payment', kind: 'write', risk: 'confirm', roles: FRONT.concat('accountant'), module: 'pms', label: { sq: 'Regjistroj pagesën', en: 'Recording the payment' }, description: 'Record a payment (or refund with refund=true) on a booking.', parameters: obj({ code: S, amount: N, method: { type: 'string', enum: ['cash', 'card', 'bank_transfer', 'online'] }, refund: B, reference: S }, ['code', 'amount', 'method']), summarize: (a, l) => t2(l, `${a.refund ? 'RIMBURSIM' : 'Pagesë'} ${str(a.amount)} (${str(a.method)}) te ${str(a.code)}`, `${a.refund ? 'REFUND' : 'Payment'} ${str(a.amount)} (${str(a.method)}) on ${str(a.code)}`), run: async (ctx, a) => act(recordPayment({ bookingId: (await bookingByCode(ctx, str(a.code))).id, amount: Number(a.amount), method: str(a.method), refund: a.refund === true, reference: str(a.reference) || undefined })) },
  { name: 'post_charge', kind: 'write', risk: 'confirm', roles: FRONT, module: 'pms', label: { sq: 'Shtoj shpenzim në faturë', en: 'Posting a charge' }, description: 'Post a charge to the guest folio.', parameters: obj({ code: S, type: { type: 'string', enum: ['restaurant', 'bar', 'pool_bar', 'room_service', 'spa', 'minibar', 'service', 'discount'] }, description: S, quantity: N, unitPrice: N }, ['code', 'type', 'description', 'unitPrice']), summarize: (a, l) => t2(l, `Shpenzim ${str(a.description)} × ${a.quantity ?? 1} @ ${str(a.unitPrice)} te ${str(a.code)}`, `Charge ${str(a.description)} × ${a.quantity ?? 1} @ ${str(a.unitPrice)} on ${str(a.code)}`), run: async (ctx, a) => act(postCharge({ bookingId: (await bookingByCode(ctx, str(a.code))).id, type: str(a.type), description: str(a.description), quantity: Number(a.quantity) || 1, unitPrice: Number(a.unitPrice) })) },
  { name: 'update_guest', kind: 'write', risk: 'safe', roles: FRONT, module: 'pms', label: { sq: 'Përditësoj mysafirin', en: 'Updating the guest' }, description: 'Update guest fields (only the ones you pass change). Get guest_id from find_guests.', parameters: obj({ guest_id: S, firstName: S, lastName: S, email: S, phone: S, nationality: S, isVip: B, notes: S, tags: S }, ['guest_id']), summarize: (a, l) => t2(l, `Përditëso mysafirin ${str(a.guest_id).slice(0, 8)}…`, `Update guest ${str(a.guest_id).slice(0, 8)}…`),
    run: async (ctx, a) => { const [g] = await db.select().from(guests).where(and(eq(guests.orgId, ctx.org.id), eq(guests.id, str(a.guest_id)))).limit(1); if (!g) throw new Error('guest not found'); return act(updateGuest({ guestId: g.id, firstName: str(a.firstName) || g.firstName, lastName: str(a.lastName) || g.lastName, email: a.email !== undefined ? str(a.email) : g.email ?? undefined, phone: a.phone !== undefined ? str(a.phone) : g.phone ?? undefined, nationality: a.nationality !== undefined ? str(a.nationality) : g.nationality ?? undefined, isVip: a.isVip !== undefined ? a.isVip === true : g.isVip, marketingConsent: g.marketingConsent, tags: a.tags !== undefined ? str(a.tags) : g.tags.join(', '), notes: a.notes !== undefined ? str(a.notes) : g.notes ?? undefined })); } },
  { name: 'set_room_status', kind: 'write', risk: 'safe', roles: HK, module: 'pms', label: { sq: 'Ndryshoj statusin e dhomës', en: 'Changing room status' }, description: 'Set a room to clean, dirty, inspected or out_of_order.', parameters: obj({ room_number: S, status: { type: 'string', enum: ['clean', 'dirty', 'inspected', 'out_of_order'] } }, ['room_number', 'status']), summarize: (a, l) => t2(l, `Dhoma ${str(a.room_number)} → ${str(a.status)}`, `Room ${str(a.room_number)} → ${str(a.status)}`), run: async (ctx, a) => act(changeRoomStatus(fd({ roomId: (await roomByNumber(ctx, str(a.room_number))).id, status: str(a.status) }))) },
  { name: 'create_housekeeping_task', kind: 'write', risk: 'safe', roles: HK, module: 'pms', label: { sq: 'Krijoj detyrë pastrimi', en: 'Creating a cleaning task' }, description: 'Create a housekeeping task.', parameters: obj({ room_number: S, type: { type: 'string', enum: ['checkout_clean', 'stayover', 'inspection', 'deep_clean', 'turndown'] }, priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] }, notes: S, dueDate: DATE }, ['room_number', 'type']), summarize: (a, l) => t2(l, `Detyrë pastrimi (${str(a.type)}) për dhomën ${str(a.room_number)}`, `Cleaning task (${str(a.type)}) for room ${str(a.room_number)}`), run: async (ctx, a) => act(createHousekeepingTask(fd({ roomId: (await roomByNumber(ctx, str(a.room_number))).id, type: str(a.type), priority: str(a.priority) || 'normal', notes: str(a.notes), dueDate: str(a.dueDate) }))) },
  { name: 'report_maintenance', kind: 'write', risk: 'safe', roles: HK, module: 'pms', label: { sq: 'Raportoj defekt', en: 'Reporting a fault' }, description: 'Open a maintenance ticket for a room (blocks_room takes it out of service).', parameters: obj({ room_number: S, title: S, description: S, priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'] }, blocks_room: B }, ['room_number', 'title']), summarize: (a, l) => t2(l, `Defekt te dhoma ${str(a.room_number)}: ${str(a.title)}`, `Fault in room ${str(a.room_number)}: ${str(a.title)}`), run: async (ctx, a) => act(createMaintenanceTicket(fd({ roomId: (await roomByNumber(ctx, str(a.room_number))).id, title: str(a.title), description: str(a.description), priority: str(a.priority) || 'normal', blocksRoom: a.blocks_room === true }))) },
  { name: 'set_rates', kind: 'write', risk: 'confirm', roles: MGR, module: 'calendar', label: { sq: 'Ndryshoj çmimet', en: 'Changing rates' }, description: 'Change price (absolute or adjust_pct), min stay or closed flag over a date range. Reaches every sales channel.', parameters: obj({ room_type: S, from: DATE, to: DATE, price: N, adjust_pct: N, min_stay: N, closed: B }, ['room_type', 'from', 'to']), summarize: (a, l) => t2(l, `Çmime ${str(a.room_type)} ${str(a.from)}→${str(a.to)}: ${a.price ? `${str(a.price)}` : a.adjust_pct ? `${Number(a.adjust_pct) > 0 ? '+' : ''}${str(a.adjust_pct)}%` : ''}${a.closed !== undefined ? (a.closed ? ' mbyllur' : ' hapur') : ''}${a.min_stay ? ` min ${str(a.min_stay)} net` : ''}`, `Rates ${str(a.room_type)} ${str(a.from)}→${str(a.to)}: ${a.price ? `${str(a.price)}` : a.adjust_pct ? `${Number(a.adjust_pct) > 0 ? '+' : ''}${str(a.adjust_pct)}%` : ''}${a.closed !== undefined ? (a.closed ? ' closed' : ' open') : ''}${a.min_stay ? ` min ${str(a.min_stay)} nights` : ''}`), run: async (ctx, a) => act(setRates({ roomTypeId: (await typeByRef(ctx, str(a.room_type))).id, from: str(a.from), to: str(a.to), price: a.price !== undefined ? Number(a.price) : undefined, adjustPct: a.adjust_pct !== undefined ? Number(a.adjust_pct) : undefined, minStay: a.min_stay !== undefined ? Number(a.min_stay) : undefined, closed: a.closed !== undefined ? a.closed === true : undefined })) },
  { name: 'issue_invoice', kind: 'write', risk: 'confirm', roles: FIN.concat('receptionist'), module: 'invoicing', label: { sq: 'Lëshoj faturën', en: 'Issuing the invoice' }, description: 'Issue (and fiscalize) the invoice for a booking folio.', parameters: obj({ code: S, buyer_name: S, buyer_nipt: S }, ['code']), summarize: (a, l) => t2(l, `Lësho faturë fiskale për ${str(a.code)}`, `Issue fiscal invoice for ${str(a.code)}`),
    run: async (ctx, a) => { const b = await bookingByCode(ctx, str(a.code)); const [f] = await db.select({ id: folios.id }).from(folios).where(and(eq(folios.orgId, ctx.org.id), eq(folios.bookingId, b.id))).limit(1); if (!f) throw new Error('This booking has no folio yet (check the guest in first).'); return act(issueInvoice({ folioId: f.id, buyerName: str(a.buyer_name) || undefined, buyerNipt: str(a.buyer_nipt) || undefined, fiscalize: true })); } },
  { name: 'fiscalize_invoice', kind: 'write', risk: 'safe', roles: FIN, module: 'fiscalization', label: { sq: 'Fiskalizoj faturën', en: 'Fiscalizing' }, description: 'Fiscalize an issued/failed invoice by id (from list_invoices).', parameters: obj({ invoice_id: S }, ['invoice_id']), summarize: (a, l) => t2(l, `Fiskalizo faturën ${str(a.invoice_id).slice(0, 8)}…`, `Fiscalize invoice ${str(a.invoice_id).slice(0, 8)}…`), run: (_c, a) => act(fiscalizeInvoiceAction(str(a.invoice_id))) },
  { name: 'cancel_invoice', kind: 'write', risk: 'confirm', roles: MGR, module: 'invoicing', label: { sq: 'Anuloj faturën', en: 'Cancelling the invoice' }, description: 'Cancel an invoice with a reason.', parameters: obj({ invoice_id: S, reason: S }, ['invoice_id', 'reason']), summarize: (a, l) => t2(l, `ANULO faturën ${str(a.invoice_id).slice(0, 8)}…: ${str(a.reason)}`, `CANCEL invoice ${str(a.invoice_id).slice(0, 8)}…: ${str(a.reason)}`), run: (_c, a) => act(cancelInvoice({ invoiceId: str(a.invoice_id), reason: str(a.reason) })) },
  { name: 'add_expense', kind: 'write', risk: 'safe', roles: FIN, module: 'expenses', label: { sq: 'Shtoj shpenzim', en: 'Adding an expense' }, description: 'Record an expense.', parameters: obj({ supplier: S, amount: N, vat: N, currency: { type: 'string', enum: ['ALL', 'EUR', 'USD'] }, category: S, department: { type: 'string', enum: ['rooms', 'restaurant', 'bar', 'spa', 'maintenance', 'marketing', 'admin', 'staff', 'other'] }, date: DATE, payment_method: { type: 'string', enum: ['cash', 'card', 'bank_transfer'] }, description: S }, ['supplier', 'amount', 'category', 'department']), summarize: (a, l) => t2(l, `Shpenzim ${str(a.amount)} ${str(a.currency) || ''} te ${str(a.supplier)} (${str(a.category)})`, `Expense ${str(a.amount)} ${str(a.currency) || ''} at ${str(a.supplier)} (${str(a.category)})`), run: async (ctx, a) => act(saveExpense({ supplierName: str(a.supplier), amount: Number(a.amount), vatAmount: Number(a.vat) || 0, currency: str(a.currency) || ctx.org.currency, category: str(a.category), department: str(a.department), expenseDate: str(a.date) || todayIn(ctx.org.timezone), paymentMethod: str(a.payment_method) || undefined, description: str(a.description) || undefined })) },
  { name: 'book_spa', kind: 'write', risk: 'safe', roles: FRONT.concat('spa'), module: 'spa', label: { sq: 'Rezervoj spa', en: 'Booking the spa' }, description: 'Book a spa appointment. service_name and therapist_name are matched loosely; identify the guest by booking_code (in house) or guest_name.', parameters: obj({ service_name: S, therapist_name: S, date: DATE, time: { type: 'string', description: 'HH:mm' }, booking_code: S, guest_name: S }, ['service_name', 'date', 'time']), summarize: (a, l) => t2(l, `Spa: ${str(a.service_name)} më ${str(a.date)} ${str(a.time)} për ${str(a.guest_name) || str(a.booking_code)}`, `Spa: ${str(a.service_name)} on ${str(a.date)} ${str(a.time)} for ${str(a.guest_name) || str(a.booking_code)}`),
    run: async (ctx, a) => { const spa = await getSpa(ctx, str(a.date), 'sq'); const like = (s: string, q: string) => s.toLowerCase().includes(q.toLowerCase()); const svc = spa.services.find((s) => s.isActive && (like(s.nameSq, str(a.service_name)) || like(s.nameEn, str(a.service_name)))); if (!svc) throw new Error(`Unknown treatment. Available: ${spa.services.map((s) => s.nameSq).join(', ')}`); const th = (a.therapist_name ? spa.therapists.find((t) => like(t.name, str(a.therapist_name))) : spa.therapists[0]) ?? spa.therapists[0]; if (!th) throw new Error('No therapist'); const b = a.booking_code ? await bookingByCode(ctx, str(a.booking_code)) : null; return act(bookAppointment({ serviceId: svc.id, therapistId: th.id, date: str(a.date), time: str(a.time), bookingId: b?.id, guestName: b ? undefined : str(a.guest_name) })); } },
  { name: 'set_spa_status', kind: 'write', risk: 'safe', roles: FRONT.concat('spa'), module: 'spa', label: { sq: 'Përditësoj termin spa', en: 'Updating spa appointment' }, description: 'Set a spa appointment status by id (from spa_schedule).', parameters: obj({ appointment_id: S, status: { type: 'string', enum: ['confirmed', 'completed', 'cancelled', 'no_show'] } }, ['appointment_id', 'status']), summarize: (a, l) => t2(l, `Termi spa → ${str(a.status)}`, `Spa appointment → ${str(a.status)}`), run: (_c, a) => act(setAppointmentStatus({ id: str(a.appointment_id), status: str(a.status) })) },
  { name: 'reply_to_guest', kind: 'write', risk: 'confirm', roles: FRONT, module: 'inbox', label: { sq: 'Dërgoj mesazh mysafirit', en: 'Messaging the guest' }, description: 'Send a message to a guest in an inbox conversation (id from list_conversations). Always needs human approval.', parameters: obj({ conversation_id: S, text: S }, ['conversation_id', 'text']), summarize: (a, l) => t2(l, `Dërgo mesazh: “${str(a.text).slice(0, 140)}”`, `Send message: “${str(a.text).slice(0, 140)}”`), run: (_c, a) => act(sendStaffMessage({ conversationId: str(a.conversation_id), body: str(a.text) })) },
  { name: 'resolve_alert', kind: 'write', risk: 'safe', roles: MGR, label: { sq: 'Zgjidh alarmin', en: 'Resolving the alert' }, description: 'Mark an alert resolved (id from open_alerts).', parameters: obj({ alert_id: S }, ['alert_id']), summarize: (a, l) => t2(l, 'Zgjidh një alarm', 'Resolve an alert'), run: (_c, a) => act(resolveAlert(str(a.alert_id))) },
  { name: 'apply_pricing_suggestion', kind: 'write', risk: 'confirm', roles: MGR, module: 'calendar', label: { sq: 'Aplikoj sugjerimin e çmimit', en: 'Applying price suggestion' }, description: 'Apply a pricing_suggestion alert to rates (alert id from open_alerts).', parameters: obj({ alert_id: S }, ['alert_id']), summarize: (a, l) => t2(l, 'Apliko sugjerimin e çmimit (ndryshon çmimet)', 'Apply the price suggestion (changes rates)'), run: (_c, a) => act(applyPricingSuggestion(str(a.alert_id))) },
];

export function toolsFor(ctx: OrgContext) {
  return AGENT_TOOLS.filter((t) => (ctx.profile.isSuperAdmin || t.roles.includes(ctx.role)) && (!t.module || ctx.modules.has(t.module)));
}
