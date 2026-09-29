import 'server-only';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { roomTypes } from '@/db/schema';
import type { AgentTool } from '@/lib/ai/openrouter';
import { todayIn } from '@/lib/dates';
import { env } from '@/lib/env';
import { ActionError } from '@/server/actions/kit';
import { getPublicContent, type PublicOrg } from '@/server/services/public-site';
import { quoteStay } from '@/server/services/stay';
import { createWebBookingCore } from '@/server/services/web-booking';

/** Read-only hotel tools plus one narrow write (book_room, same rules as the public booking form). Shared by chat, WhatsApp and voice. */
export async function buildGuestTools(pub: PublicOrg, locale: 'sq' | 'en', source: 'website' | 'whatsapp' | 'instagram' | 'messenger' | 'phone' = 'website') {
  const { org } = pub;
  const p = { locale };
  const today = todayIn(org.timezone);
  const content = await getPublicContent(org.id, locale);
  let bookingLink: { code: string; url: string } | null = null;
  let handedOff = false;

  const dateArgs = z.object({ checkIn: z.iso.date(), checkOut: z.iso.date(), adults: z.coerce.number().int().min(1).max(10).default(2), children: z.coerce.number().int().min(0).max(8).default(0) });

  const tools: AgentTool[] = [
    {
      name: 'list_rooms',
      description: 'List room types with base price per night, size, occupancy and amenities. Read-only.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
      run: () => content.types.map((t) => ({ id: t.id, name: t.name, description: t.description, fromPricePerNight: t.basePrice, currency: org.currency, maxGuests: t.maxOccupancy, sizeSqm: t.sizeSqm, view: t.view, amenities: t.amenities })),
    },
    {
      name: 'check_availability',
      description: 'Check live availability and the exact total price for a stay. Dates are YYYY-MM-DD.',
      parameters: {
        type: 'object',
        properties: { checkIn: { type: 'string' }, checkOut: { type: 'string' }, adults: { type: 'number' }, children: { type: 'number' } },
        required: ['checkIn', 'checkOut'],
        additionalProperties: false,
      },
      run: async (args) => {
        const a = dateArgs.parse(args);
        if (a.checkIn < today) return { error: 'checkIn is in the past' };
        const types = await db.select({ id: roomTypes.id, name: roomTypes.name }).from(roomTypes).where(and(eq(roomTypes.orgId, org.id), eq(roomTypes.isActive, true)));
        const out = [];
        for (const t of types) {
          const quote = await quoteStay(db, { orgId: org.id, roomTypeId: t.id, checkIn: a.checkIn, checkOut: a.checkOut, guests: a.adults + a.children });
          const name = content.types.find((c) => c.id === t.id)?.name ?? t.id;
          out.push(quote.ok ? { roomTypeId: t.id, name, available: true, roomsLeft: quote.available, total: quote.total, nights: quote.nights, currency: org.currency } : { roomTypeId: t.id, name, available: false, reason: quote.reason });
        }
        return out;
      },
    },
    {
      name: 'get_spa_and_dining',
      description: 'Spa treatments with prices, and restaurant/bar outlets with opening hours. Read-only.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
      run: () => ({ spa: content.spa.map((s) => ({ name: s.name, minutes: s.durationMin, price: s.price })), outlets: content.outlets.map((o) => ({ name: o.name, type: o.type, hours: o.hours })), currency: org.currency }),
    },
    {
      name: 'book_room',
      description: 'Create a real booking (pay at the hotel). ONLY call after the guest has confirmed room type, dates and given first name, last name, email and phone.',
      parameters: {
        type: 'object',
        properties: {
          roomTypeId: { type: 'string' }, checkIn: { type: 'string' }, checkOut: { type: 'string' }, adults: { type: 'number' }, children: { type: 'number' },
          first: { type: 'string' }, last: { type: 'string' }, email: { type: 'string' }, phone: { type: 'string' }, requests: { type: 'string' },
        },
        required: ['roomTypeId', 'checkIn', 'checkOut', 'first', 'last', 'email', 'phone'],
        additionalProperties: false,
      },
      run: async (args) => {
        try {
          const a = z
            .object({ roomTypeId: z.uuid(), first: z.string(), last: z.string(), email: z.string(), phone: z.string(), requests: z.string().optional() })
            .and(dateArgs)
            .parse(args);
          const r = await createWebBookingCore(pub, {
            slug: org.slug, locale: p.locale, roomTypeId: a.roomTypeId, checkIn: a.checkIn, checkOut: a.checkOut, adults: a.adults, children: a.children,
            first: a.first, last: a.last, email: a.email, phone: a.phone, requests: a.requests, pay: 'hotel', source,
          });
          bookingLink = { code: r.code, url: `${env.NEXT_PUBLIC_APP_URL}${r.redirect}` };
          return { booked: true, code: r.code, total: r.booking.totalAmount, currency: org.currency, note: 'Confirmation email sent. Guest pays at the hotel.' };
        } catch (e) {
          return { booked: false, error: e instanceof ActionError ? e.message : 'invalid details' };
        }
      },
    },
    {
      name: 'handoff_to_human',
      description: 'Pass the conversation to a human when asked, when unsure, for complaints, group/wedding requests, or anything you cannot answer from the data.',
      parameters: { type: 'object', properties: { reason: { type: 'string' } }, required: ['reason'], additionalProperties: false },
      run: () => {
        handedOff = true;
        return { handedOff: true };
      },
    },
  ];

  return { tools, state: { get bookingLink() { return bookingLink; }, get handedOff() { return handedOff; } } };
}
