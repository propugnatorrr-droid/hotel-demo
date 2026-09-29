import 'server-only';

import type { ChannelAdapter, ChannelRevision, SimChannel } from './types';

/** Demo adapter: pushes succeed instantly, the feed is empty (demo bookings are injected by simulate). */
export const mockAdapter: ChannelAdapter = {
  kind: 'mock',
  async pushAvailability() {
    return { warnings: [] };
  },
  async pushRestrictions() {
    return { warnings: [] };
  },
  async fetchFeed() {
    return [];
  },
  async ack() {},
};

const POOLS = [
  { country: 'IT', language: 'it', phone: '+39', first: ['Giulia', 'Marco', 'Francesca', 'Luca', 'Chiara', 'Alessandro'], last: ['Rossi', 'Bianchi', 'Esposito', 'Romano', 'Ricci', 'Greco'] },
  { country: 'DE', language: 'de', phone: '+49', first: ['Lena', 'Jonas', 'Sophie', 'Felix', 'Hannah', 'Lukas'], last: ['Müller', 'Schmidt', 'Fischer', 'Weber', 'Wagner', 'Becker'] },
  { country: 'PL', language: 'pl', phone: '+48', first: ['Zofia', 'Jakub', 'Maja', 'Kacper'], last: ['Nowak', 'Kowalski', 'Wiśniewska', 'Lewandowski'] },
  { country: 'GB', language: 'en', phone: '+44', first: ['Olivia', 'James', 'Amelia', 'Harry'], last: ['Smith', 'Taylor', 'Brown', 'Wilson'] },
  { country: 'XK', language: 'sq', phone: '+383', first: ['Arta', 'Driton', 'Blerta', 'Ilir'], last: ['Krasniqi', 'Berisha', 'Gashi', 'Hoxha'] },
  { country: 'FR', language: 'fr', phone: '+33', first: ['Camille', 'Louis', 'Léa', 'Hugo'], last: ['Martin', 'Bernard', 'Dubois', 'Moreau'] },
] as const;

const NOTES = ['Late arrival around 22:00', 'Quiet room, high floor if possible', 'Celebrating our anniversary', 'Baby cot needed', null, null, null];
const OTA = {
  booking_com: { name: 'BookingCom', commission: 0.15 },
  expedia: { name: 'Expedia', commission: 0.18 },
  airbnb: { name: 'Airbnb', commission: 0.03 },
} as const;

const rand = (n: number) => Math.floor(Math.random() * n);
const pick = <T>(arr: readonly T[]): T => arr[rand(arr.length)]!;
const digits = (n: number) => Array.from({ length: n }, () => rand(10)).join('');
const ascii = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').toLowerCase().replace(/[^a-z]/g, '');
const round2 = (n: number) => Math.round(n * 100) / 100;

export function buildMockRevision(input: {
  channel: SimChannel;
  externalRoomTypeId: string;
  checkIn: string;
  checkOut: string;
  amount: number;
  maxOccupancy: number;
  currency: string;
}): ChannelRevision {
  const pool = pick(POOLS);
  const firstName = pick(pool.first);
  const lastName = pick(pool.last);
  const ota = OTA[input.channel];
  const otaCode =
    input.channel === 'airbnb'
      ? `HM${Array.from({ length: 8 }, () => pick('ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.split(''))).join('')}`
      : digits(input.channel === 'booking_com' ? 10 : 9);
  const email =
    input.channel === 'booking_com'
      ? `${ascii(firstName)}.${ascii(lastName)}.${digits(4)}@guest.booking.com`
      : input.channel === 'expedia'
        ? `${ascii(firstName)}${digits(3)}@m.expediapartnercentral.com`
        : null;
  const adults = Math.min(2, Math.max(1, input.maxOccupancy));
  const children = input.maxOccupancy > 2 && Math.random() < 0.3 ? 1 : 0;

  return {
    id: crypto.randomUUID(),
    propertyId: 'mock',
    status: 'new',
    otaName: ota.name,
    otaCode,
    arrival: input.checkIn,
    departure: input.checkOut,
    arrivalHour: `${14 + rand(9)}:00`,
    amount: input.amount,
    commission: round2(input.amount * ota.commission),
    currency: input.currency,
    notes: pick(NOTES),
    paymentCollect: input.channel === 'airbnb' ? 'ota' : input.channel === 'expedia' && Math.random() < 0.5 ? 'ota' : 'property',
    customer: { firstName, lastName, email, phone: pool.phone + digits(9), country: pool.country, language: pool.language },
    rooms: [
      { externalRoomTypeId: input.externalRoomTypeId, checkIn: input.checkIn, checkOut: input.checkOut, amount: input.amount, adults, children },
    ],
  };
}
