import 'server-only';
import { and, desc, eq, gte, ilike, inArray, or } from 'drizzle-orm';
import { db } from '@/db';
import { auditLogs, bookings, conversations, guests, messages } from '@/db/schema';
import { aiConfigured } from '@/lib/ai/openrouter';
import { takeAiBudget } from '@/lib/ai/budget';
import { extractPassport } from '@/lib/ai/ocr';
import { addDays, todayIn } from '@/lib/dates';
import { fetchWhatsappMedia, sendChannelMessage, type OutChannel } from '@/lib/integrations/messaging';
import { guestAiReply } from '@/server/services/guest-ai';
import { getPublicOrg } from '@/server/services/public-site';
import { organizations } from '@/db/schema';

export type Inbound = {
  orgId: string;
  channel: Extract<OutChannel, 'whatsapp' | 'instagram' | 'messenger'>;
  sender: string; // wa_id / IGSID / PSID
  name?: string;
  text?: string;
  mediaId?: string;
  externalMessageId?: string;
};

const digits = (s: string) => s.replace(/[^\d]/g, '');

/** Stores an inbound guest message, links the guest, runs passport OCR or the AI concierge and replies. */
export async function processInbound(input: Inbound) {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, input.orgId)).limit(1);
  if (!org || org.status === 'suspended') return;

  if (input.externalMessageId) {
    const [dup] = await db.select({ id: messages.id }).from(messages).where(and(eq(messages.orgId, org.id), eq(messages.externalId, input.externalMessageId))).limit(1);
    if (dup) return;
  }

  let [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.orgId, org.id), eq(conversations.channel, input.channel), eq(conversations.externalId, input.sender)))
    .limit(1);

  if (!conv) {
    // Link to an existing guest by phone (WhatsApp sender is a phone number).
    let guestId: string | null = null;
    if (input.channel === 'whatsapp') {
      const d = digits(input.sender);
      const [g] = await db.select({ id: guests.id }).from(guests).where(and(eq(guests.orgId, org.id), ilike(guests.phone, `%${d.slice(-8)}%`))).limit(1);
      guestId = g?.id ?? null;
    }
    [conv] = await db
      .insert(conversations)
      .values({ orgId: org.id, channel: input.channel, externalId: input.sender, contactName: input.name ?? input.sender, contactHandle: input.channel === 'whatsapp' ? `+${digits(input.sender)}` : input.sender, guestId, language: org.defaultLocale })
      .returning();
  }
  if (!conv) return;

  const body = input.text?.trim() || (input.mediaId ? '📷' : '');
  if (!body) return;
  await db.insert(messages).values({
    orgId: org.id, conversationId: conv.id, direction: 'inbound', author: 'guest', body, externalId: input.externalMessageId,
    attachments: input.mediaId ? [{ type: 'image', url: `wa-media:${input.mediaId}` }] : [],
  });
  await db
    .update(conversations)
    .set({ lastMessageAt: new Date(), lastMessagePreview: body.slice(0, 120), unreadCount: conv.unreadCount + 1 })
    .where(eq(conversations.id, conv.id));

  const reply = async (text: string, meta: Record<string, unknown> = {}) => {
    const sent = await sendChannelMessage({ orgId: org.id, channel: input.channel, to: input.sender, text });
    await db.insert(messages).values({ orgId: org.id, conversationId: conv!.id, direction: 'outbound', author: 'ai', body: text, aiMeta: { model: 'openrouter', ...meta }, deliveredAt: sent.ok ? new Date() : null, externalId: sent.externalId });
    await db.update(conversations).set({ lastMessageAt: new Date(), lastMessagePreview: text.slice(0, 120) }).where(eq(conversations.id, conv!.id));
  };
  const lang = conv.language === 'en' ? 'en' : 'sq';

  // Contactless check-in: a photo on WhatsApp is treated as an ID document.
  if (input.mediaId && input.channel === 'whatsapp') {
    const image = await fetchWhatsappMedia(input.mediaId);
    const doc = image && aiConfigured() ? await extractPassport(image).catch(() => null) : null;
    if (doc) {
      const guestId = await applyDocumentToGuest(org.id, org.timezone, conv.guestId, `+${digits(input.sender)}`, doc);
      if (guestId && !conv.guestId) await db.update(conversations).set({ guestId }).where(eq(conversations.id, conv.id));
      await db.insert(auditLogs).values({ orgId: org.id, action: 'checkin.document_scanned', entityType: 'guest', entityId: guestId, meta: { channel: 'whatsapp', confidence: doc.confidence } });
      await reply(lang === 'en' ? `Thank you ${doc.firstName ?? ''}! Your details were received. The front desk will have your room key ready.` : `Faleminderit ${doc.firstName ?? ''}! Të dhënat u pranuan. Recepsioni do ta ketë çelësin gati.`, { ocr: true });
      return;
    }
  }

  if (conv.status !== 'ai_handling' || !conv.aiEnabled || !input.text) return;
  const pub = await getPublicOrg(org.slug);
  if (!pub || !aiConfigured() || !(await takeAiBudget(org.id, null, 'guestchat', 400))) {
    await db.update(conversations).set({ status: 'needs_human' }).where(eq(conversations.id, conv.id));
    return;
  }
  try {
    const out = await guestAiReply({ pub, conv, message: input.text, locale: lang });
    await reply(out.text);
    if (out.handedOff) await db.update(conversations).set({ status: 'needs_human' }).where(eq(conversations.id, conv.id));
  } catch (e) {
    console.error('[inbound-ai]', e);
    await db.update(conversations).set({ status: 'needs_human' }).where(eq(conversations.id, conv.id));
  }
}

/** Writes OCR'd identity data to the guest (creating one when needed) and to today's arrival booking. */
export async function applyDocumentToGuest(orgId: string, tz: string, guestId: string | null, phone: string, doc: NonNullable<Awaited<ReturnType<typeof extractPassport>>>) {
  const patch = {
    documentType: doc.documentType,
    documentNumber: doc.documentNumber,
    dateOfBirth: doc.dateOfBirth,
    nationality: doc.nationality,
    // Retention: delete document data after the stay window (GDPR-aligned), see PLAN §10.4.
    documentDeleteAfter: new Date(Date.now() + 30 * 86_400_000),
  };
  if (guestId) {
    await db.update(guests).set(patch).where(and(eq(guests.orgId, orgId), eq(guests.id, guestId)));
    return guestId;
  }
  const today = todayIn(tz);
  // Try to match a guest with an upcoming arrival by name.
  if (doc.lastName) {
    const rows = await db
      .select({ id: guests.id })
      .from(guests)
      .innerJoin(bookings, eq(bookings.guestId, guests.id))
      .where(and(eq(guests.orgId, orgId), ilike(guests.lastName, doc.lastName), inArray(bookings.status, ['tentative', 'confirmed', 'checked_in']), gte(bookings.checkOut, today), or(eq(bookings.checkIn, today), gte(bookings.checkIn, addDays(today, -1)))))
      .orderBy(desc(bookings.checkIn))
      .limit(1);
    if (rows[0]) {
      await db.update(guests).set({ ...patch, phone }).where(eq(guests.id, rows[0].id));
      return rows[0].id;
    }
  }
  const [g] = await db
    .insert(guests)
    .values({ orgId, firstName: doc.firstName || 'Mysafir', lastName: doc.lastName || phone, phone, ...patch })
    .returning({ id: guests.id });
  return g?.id ?? null;
}
