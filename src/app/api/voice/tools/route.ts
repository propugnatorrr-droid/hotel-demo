import { timingSafeEqual } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { callLogs, conversations, integrations, messages, organizations } from '@/db/schema';
import { getIntegration } from '@/lib/integrations/registry';
import { buildGuestTools } from '@/server/services/guest-tools';
import { getPublicOrg } from '@/server/services/public-site';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const safeEq = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

type ToolCall = { id: string; name?: string; arguments?: unknown; function?: { name: string; arguments: unknown } };
type VapiMessage = {
  type: string;
  toolCallList?: ToolCall[];
  toolCalls?: ToolCall[];
  call?: { id?: string; customer?: { number?: string }; phoneNumber?: { number?: string } };
  summary?: string;
  transcript?: string;
  durationSeconds?: number;
  recordingUrl?: string;
  endedReason?: string;
  artifact?: { messages?: { role: string; message?: string; time?: number }[]; recordingUrl?: string; transcript?: string };
  analysis?: { summary?: string; structuredData?: Record<string, unknown> };
};

/**
 * Vapi server URL: `/api/voice/tools?org=<slug>` with header `x-vapi-secret: $VAPI_SERVER_SECRET`.
 * Handles tool calls (same tools as the chat concierge) and end-of-call reports (call log + inbox entry).
 * Audio is handled entirely by the voice provider; this endpoint only serves data.
 */
export async function POST(request: Request) {
  const secret = process.env.VAPI_SERVER_SECRET;
  if (!secret || !safeEq(request.headers.get('x-vapi-secret') ?? '', secret)) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const slug = new URL(request.url).searchParams.get('org') ?? '';
  const pub = await getPublicOrg(slug);
  if (!pub || !pub.modules.has('voice_agent')) return Response.json({ error: 'Not found' }, { status: 404 });
  const { org } = pub;
  const integ = await getIntegration(org.id, 'vapi');
  if (!integ.enabled) return Response.json({ error: 'disabled' }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { message?: VapiMessage } | null;
  const msg = body?.message;
  if (!msg) return Response.json({ error: 'invalid' }, { status: 400 });
  const lang = org.defaultLocale === 'en' ? 'en' : 'sq';

  if (msg.type === 'tool-calls') {
    const { tools, state } = await buildGuestTools(pub, lang, 'phone');
    const calls = msg.toolCallList ?? msg.toolCalls ?? [];
    const results = [];
    for (const c of calls.slice(0, 4)) {
      const name = c.function?.name ?? c.name ?? '';
      let args: Record<string, unknown> = {};
      const raw = c.function?.arguments ?? c.arguments;
      try {
        args = typeof raw === 'string' ? (JSON.parse(raw) as Record<string, unknown>) : ((raw ?? {}) as Record<string, unknown>);
      } catch {
        /* keep empty */
      }
      let result: unknown;
      if (name === 'transfer_to_staff') {
        const num = typeof org.settings.frontDeskPhone === 'string' ? org.settings.frontDeskPhone : org.phone;
        result = { transferTo: num, note: 'Tell the caller you are connecting them to reception.' };
      } else {
        const tool = tools.find((t) => t.name === name);
        try {
          result = tool ? await tool.run(args) : { error: 'Unknown tool' };
        } catch (e) {
          result = { error: e instanceof Error ? e.message : 'Tool failed' };
        }
      }
      results.push({ toolCallId: c.id, result: JSON.stringify(result).slice(0, 8000) });
    }
    void state;
    return Response.json({ results });
  }

  if (msg.type === 'end-of-call-report') {
    const callId = msg.call?.id ?? `call_${crypto.randomUUID()}`;
    const from = msg.call?.customer?.number ?? null;
    const [dupe] = await db.select({ id: callLogs.id }).from(callLogs).where(and(eq(callLogs.orgId, org.id), eq(callLogs.externalId, callId))).limit(1);
    if (dupe) return Response.json({ ok: true });

    const transcript = (msg.artifact?.messages ?? [])
      .filter((m) => m.role === 'user' || m.role === 'assistant' || m.role === 'bot')
      .map((m) => ({ role: (m.role === 'user' ? 'caller' : 'ai') as 'ai' | 'caller', text: String(m.message ?? '').slice(0, 1500), at: m.time }));
    const summary = (msg.analysis?.summary ?? msg.summary ?? '').slice(0, 1500);
    const transferred = /transfer/i.test(msg.endedReason ?? '') || transcript.some((t) => /reception|recepsion/i.test(t.text) && t.role === 'ai' && /transfer|lidh/i.test(t.text));

    await db.transaction(async (tx) => {
      const [conv] = await tx
        .insert(conversations)
        .values({ orgId: org.id, channel: 'voice', externalId: callId, contactName: from ?? 'Telefonatë', contactHandle: from, language: lang, status: transferred ? 'needs_human' : 'resolved', unreadCount: transferred ? 1 : 0, lastMessagePreview: summary.slice(0, 120) })
        .returning({ id: conversations.id });
      await tx.insert(messages).values({ orgId: org.id, conversationId: conv!.id, direction: 'inbound', author: 'system', body: summary || 'Telefonatë e regjistruar.' });
      await tx.insert(callLogs).values({
        orgId: org.id, conversationId: conv!.id, provider: 'vapi', externalId: callId, fromNumber: from, toNumber: msg.call?.phoneNumber?.number ?? org.phone, language: lang,
        durationSec: Math.round(msg.durationSeconds ?? 0), outcome: transferred ? 'transferred' : (msg.endedReason ?? 'completed').slice(0, 60), summary, transcript, recordingUrl: msg.recordingUrl ?? msg.artifact?.recordingUrl ?? null, transferredTo: transferred ? 'reception' : null,
      });
    });
    return Response.json({ ok: true });
  }

  return Response.json({ ok: true }); // status-update, speech-update, etc.
}

void integrations;
void organizations;
