import { and, eq } from 'drizzle-orm';
import { after } from 'next/server';
import { db } from '@/db';
import { integrations } from '@/db/schema';
import { verifyMetaSignature } from '@/lib/integrations/messaging';
import { processInbound, type Inbound } from '@/server/services/inbox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Meta webhook verification handshake. */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  if (q.get('hub.mode') === 'subscribe' && process.env.META_VERIFY_TOKEN && q.get('hub.verify_token') === process.env.META_VERIFY_TOKEN) {
    return new Response(q.get('hub.challenge') ?? '', { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

type WaValue = {
  metadata?: { phone_number_id?: string };
  contacts?: { profile?: { name?: string }; wa_id?: string }[];
  messages?: { from: string; id: string; type: string; text?: { body: string }; image?: { id: string } }[];
};
type Messaging = { sender?: { id: string }; message?: { mid?: string; text?: string; is_echo?: boolean } };

async function orgFor(provider: 'meta_whatsapp' | 'meta_instagram' | 'meta_messenger', accountId: string | undefined) {
  if (!accountId) return null;
  const [row] = await db
    .select({ orgId: integrations.orgId })
    .from(integrations)
    .where(and(eq(integrations.provider, provider), eq(integrations.externalAccountId, accountId), eq(integrations.isEnabled, true)))
    .limit(1);
  return row?.orgId ?? null;
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyMetaSignature(raw, request.headers.get('x-hub-signature-256'))) return new Response('Bad signature', { status: 401 });

  let body: { object?: string; entry?: { id?: string; changes?: { field?: string; value?: WaValue }[]; messaging?: Messaging[] }[] };
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  const jobs: Inbound[] = [];
  for (const entry of body.entry ?? []) {
    if (body.object === 'whatsapp_business_account') {
      for (const ch of entry.changes ?? []) {
        const v = ch.value;
        const orgId = await orgFor('meta_whatsapp', v?.metadata?.phone_number_id);
        if (!v || !orgId) continue;
        for (const m of v.messages ?? []) {
          jobs.push({
            orgId, channel: 'whatsapp', sender: m.from, name: v.contacts?.find((c) => c.wa_id === m.from)?.profile?.name,
            text: m.type === 'text' ? m.text?.body : undefined, mediaId: m.type === 'image' ? m.image?.id : undefined, externalMessageId: m.id,
          });
        }
      }
    } else if (body.object === 'instagram' || body.object === 'page') {
      const provider = body.object === 'instagram' ? 'meta_instagram' : 'meta_messenger';
      const orgId = await orgFor(provider, entry.id);
      if (!orgId) continue;
      for (const m of entry.messaging ?? []) {
        if (!m.sender?.id || !m.message?.text || m.message.is_echo) continue;
        jobs.push({ orgId, channel: body.object === 'instagram' ? 'instagram' : 'messenger', sender: m.sender.id, text: m.message.text, externalMessageId: m.message.mid });
      }
    }
  }

  // Ack fast (Meta retries slow endpoints), process after the response.
  after(async () => {
    for (const j of jobs) {
      try {
        await processInbound(j);
      } catch (e) {
        console.error('[meta-webhook]', e);
      }
    }
  });
  return new Response('OK');
}
