import 'server-only';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { callLogs } from '@/db/schema';
import type { OrgContext } from '@/lib/auth/session';
import { env } from '@/lib/env';
import { envReady } from '@/lib/integrations/registry';
import { buildGuestTools } from '@/server/services/guest-tools';
import { getPublicOrg } from '@/server/services/public-site';

export async function getVoice(ctx: OrgContext, locale: 'sq' | 'en') {
  const calls = await db.select().from(callLogs).where(eq(callLogs.orgId, ctx.org.id)).orderBy(desc(callLogs.createdAt)).limit(60);
  const serverUrl = `${env.NEXT_PUBLIC_APP_URL}/api/voice/tools?org=${ctx.org.slug}`;

  // Assistant config to paste into Vapi (Albanian speech via Azure sq-AL, tools served by this app).
  let config: Record<string, unknown> | null = null;
  const pub = await getPublicOrg(ctx.org.slug);
  if (pub) {
    const { tools } = await buildGuestTools(pub, ctx.org.defaultLocale === 'en' ? 'en' : 'sq', 'phone');
    const persona = ctx.org.aiPersona;
    const sq = ctx.org.defaultLocale !== 'en';
    const defs = [
      ...tools.filter((t) => t.name !== 'handoff_to_human').map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })),
      { name: 'transfer_to_staff', description: 'Transfer the call to the front desk when the caller asks for a person, complains, or needs something you cannot do.', parameters: { type: 'object', properties: { reason: { type: 'string' } }, required: ['reason'] } },
    ];
    config = {
      name: `${persona?.name ?? 'Asistenti'} · ${ctx.org.name}`,
      firstMessage: sq ? `Përshëndetje, keni telefonuar te ${ctx.org.name}. Si mund t’ju ndihmoj?` : `Hello, you have reached ${ctx.org.name}. How can I help?`,
      transcriber: { provider: 'azure', language: sq ? 'sq-AL' : 'en-US' },
      voice: { provider: 'azure', voiceId: sq ? 'sq-AL-AnilaNeural' : 'en-GB-SoniaNeural' },
      model: {
        provider: 'openrouter',
        model: process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4.1-flash',
        messages: [{
          role: 'system',
          content: [
            `You are ${persona?.name ?? 'the receptionist'} answering the phone for ${ctx.org.name}${ctx.org.city ? ` in ${ctx.org.city}, Albania` : ''}.`,
            persona?.tone ? `Tone: ${persona.tone}.` : '',
            persona?.instructions ? `Hotel facts: ${persona.instructions}` : '',
            'Speak briefly, one or two sentences at a time, like a real receptionist. Never invent prices or availability: call the tools. Spell out dates naturally.',
            'To book, confirm room type and dates, then ask for first name, last name, email and phone, read them back, and only then call book_room.',
            'If the caller asks for a person or is upset, call transfer_to_staff.',
          ].filter(Boolean).join('\n'),
        }],
        tools: defs.map((d) => ({ type: 'function', function: d, server: { url: serverUrl } })),
      },
      serverUrl,
      serverMessages: ['tool-calls', 'end-of-call-report'],
    };
  }

  return {
    calls: calls.map((c) => ({ id: c.id, provider: c.provider, from: c.fromNumber, language: c.language, durationSec: c.durationSec, outcome: c.outcome, summary: c.summary, transcript: c.transcript ?? [], recordingUrl: c.recordingUrl, transferredTo: c.transferredTo, createdAt: c.createdAt.toISOString() })),
    serverUrl,
    secretSet: Boolean(process.env.VAPI_SERVER_SECRET),
    keyReady: envReady('vapi'),
    config,
    frontDeskPhone: typeof ctx.org.settings.frontDeskPhone === 'string' ? ctx.org.settings.frontDeskPhone : ctx.org.phone,
  };
}

export type VoiceData = Awaited<ReturnType<typeof getVoice>>;
