import 'server-only';

import { ChannelError, type ChannelAdapter, type ChannelRevision } from './types';

const BASE = (process.env.CHANNEX_BASE_URL || 'https://staging.channex.io/api/v1').replace(/\/$/, '');

type RawRoom = {
  checkin_date?: string;
  checkout_date?: string;
  room_type_id?: string | null;
  amount?: string | number;
  occupancy?: { adults?: number; children?: number; infants?: number };
  guests?: { name?: string; surname?: string }[];
};

type RawRevision = {
  id: string;
  attributes: {
    property_id: string;
    unique_id?: string;
    ota_reservation_code?: string;
    ota_name?: string;
    status: 'new' | 'modified' | 'cancelled';
    arrival_date: string;
    departure_date: string;
    arrival_hour?: string | null;
    amount?: string | number;
    ota_commission?: string | number | null;
    currency?: string;
    notes?: string | null;
    payment_collect?: 'property' | 'ota' | null;
    customer?: { name?: string; surname?: string; mail?: string; phone?: string; country?: string; language?: string };
    rooms?: RawRoom[];
  };
};

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

function normalize(raw: RawRevision): ChannelRevision {
  const a = raw.attributes;
  const c = a.customer ?? {};
  const firstGuest = a.rooms?.[0]?.guests?.[0];
  return {
    id: raw.id,
    propertyId: a.property_id,
    status: a.status,
    otaName: a.ota_name ?? 'OTA',
    otaCode: a.ota_reservation_code ?? a.unique_id ?? raw.id,
    arrival: a.arrival_date,
    departure: a.departure_date,
    arrivalHour: str(a.arrival_hour),
    amount: num(a.amount),
    commission: num(a.ota_commission),
    currency: (a.currency ?? 'EUR').toUpperCase(),
    notes: str(a.notes),
    paymentCollect: a.payment_collect ?? null,
    customer: {
      firstName: str(c.name) ?? str(firstGuest?.name) ?? '',
      lastName: str(c.surname) ?? str(firstGuest?.surname) ?? '',
      email: str(c.mail),
      phone: str(c.phone),
      country: str(c.country),
      language: str(c.language),
    },
    rooms: (a.rooms ?? []).map((r) => ({
      externalRoomTypeId: r.room_type_id ?? null,
      checkIn: r.checkin_date ?? a.arrival_date,
      checkOut: r.checkout_date ?? a.departure_date,
      amount: num(r.amount),
      adults: Math.max(1, num(r.occupancy?.adults)),
      children: num(r.occupancy?.children) + num(r.occupancy?.infants),
    })),
  };
}

export function channexAdapter(apiKey: string): ChannelAdapter {
  async function call<T>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${BASE}${path}`, {
        method: init?.method ?? 'GET',
        headers: { 'Content-Type': 'application/json', 'user-api-key': apiKey },
        body: init?.body === undefined ? undefined : JSON.stringify(init.body),
        cache: 'no-store',
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new ChannelError('network');
    }
    if (res.status === 401) throw new ChannelError('unauthorized');
    if (res.status === 429) throw new ChannelError('rateLimited');
    if (!res.ok) throw new ChannelError(`http_${res.status}`);
    return (await res.json()) as T;
  }

  type Meta = { meta?: { warnings?: unknown[] } };
  const warningsOf = (r: Meta) => (r.meta?.warnings ?? []).map((w) => JSON.stringify(w).slice(0, 300));

  return {
    kind: 'channex',
    async pushAvailability(values) {
      return { warnings: warningsOf(await call<Meta>('/availability', { method: 'POST', body: { values } })) };
    },
    async pushRestrictions(values) {
      return { warnings: warningsOf(await call<Meta>('/restrictions', { method: 'POST', body: { values } })) };
    },
    async fetchFeed() {
      const r = await call<{ data?: RawRevision[] }>('/booking_revisions/feed?order%5Binserted_at%5D=asc');
      return (r.data ?? []).map(normalize);
    },
    async ack(revisionId) {
      await call(`/booking_revisions/${encodeURIComponent(revisionId)}/ack`, { method: 'POST' });
    },
  };
}
