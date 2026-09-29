import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getIntegration, type IntegrationProvider } from './registry';

export type OutChannel = 'whatsapp' | 'instagram' | 'messenger' | 'web_chat' | 'email' | 'sms' | 'voice' | 'booking_com' | 'airbnb';

const PROVIDER: Partial<Record<OutChannel, IntegrationProvider>> = {
  whatsapp: 'meta_whatsapp',
  instagram: 'meta_instagram',
  messenger: 'meta_messenger',
};

const GRAPH = 'https://graph.facebook.com/v21.0';

/**
 * Sends a message on a guest channel. web_chat/email/voice are handled elsewhere (polling / email adapter),
 * mock mode records delivery without any network call, live uses the Meta Graph API directly.
 */
export async function sendChannelMessage(input: { orgId: string; channel: OutChannel; to: string; text: string }): Promise<{ ok: boolean; mock: boolean; externalId?: string; error?: string }> {
  const provider = PROVIDER[input.channel];
  if (!provider) return { ok: true, mock: true }; // web_chat etc: message row itself is the delivery

  const integ = await getIntegration(input.orgId, provider);
  const token = input.channel === 'whatsapp' ? process.env.WHATSAPP_TOKEN : process.env.META_PAGE_TOKEN || process.env.WHATSAPP_TOKEN;
  if (integ.mode === 'mock' || !integ.enabled || !token) return { ok: true, mock: true };

  try {
    let res: Response;
    if (input.channel === 'whatsapp') {
      const phoneId = String(integ.config.phoneNumberId ?? process.env.WHATSAPP_PHONE_NUMBER_ID ?? '');
      if (!phoneId) return { ok: false, mock: false, error: 'phone_number_id missing' };
      res = await fetch(`${GRAPH}/${phoneId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: input.to.replace(/[^\d]/g, ''), type: 'text', text: { body: input.text.slice(0, 4000) } }),
        signal: AbortSignal.timeout(15_000),
      });
    } else {
      res = await fetch(`${GRAPH}/me/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: { id: input.to }, messaging_type: 'RESPONSE', message: { text: input.text.slice(0, 1900) } }),
        signal: AbortSignal.timeout(15_000),
      });
    }
    const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; message_id?: string; error?: { message: string } };
    if (!res.ok) return { ok: false, mock: false, error: json.error?.message ?? `HTTP ${res.status}` };
    return { ok: true, mock: false, externalId: json.messages?.[0]?.id ?? json.message_id };
  } catch (e) {
    return { ok: false, mock: false, error: e instanceof Error ? e.message : 'send failed' };
  }
}

/** Downloads a WhatsApp media item (passport photo etc.) as a data URL for vision OCR. */
export async function fetchWhatsappMedia(mediaId: string): Promise<string | null> {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) return null;
  try {
    const meta = await fetch(`${GRAPH}/${mediaId}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) });
    if (!meta.ok) return null;
    const { url, mime_type } = (await meta.json()) as { url: string; mime_type: string };
    const file = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(20_000) });
    if (!file.ok) return null;
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > 6_000_000) return null;
    return `data:${mime_type};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

/** Verifies Meta's X-Hub-Signature-256 header over the raw body. */
export function verifyMetaSignature(raw: string, header: string | null) {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !header?.startsWith('sha256=')) return false;
  const expected = Buffer.from(createHmac('sha256', secret).update(raw).digest('hex'));
  const got = Buffer.from(header.slice(7));
  return expected.length === got.length && timingSafeEqual(expected, got);
}
