import { and, asc, count, desc, eq, gt, gte } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { conversations, messages, roomTypes } from '@/db/schema';
import { aiConfigured, runAgent, type AgentTool, type ChatMessage } from '@/lib/ai/openrouter';
import { takeAiBudget } from '@/lib/ai/budget';
import { todayIn } from '@/lib/dates';
import { env } from '@/lib/env';
import { ActionError } from '@/server/actions/kit';
import { getPublicContent, getPublicOrg } from '@/server/services/public-site';
import { quoteStay } from '@/server/services/stay';
import { guestAiReply } from '@/server/services/guest-ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const postSchema = z.object({
  slug: z.string().max(60),
  sessionId: z.uuid(),
  message: z.string().trim().min(1).max(1200).optional(),
  locale: z.enum(['sq', 'en']).default('sq'),
  handoff: z.boolean().optional(),
});

async function findConversation(orgId: string, sessionId: string) {
  const [c] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.orgId, orgId), eq(conversations.channel, 'web_chat'), eq(conversations.externalId, `web-${sessionId}`)))
    .limit(1);
  return c;
}

/** Poll for staff / AI messages the client has not seen yet. */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const slug = q.get('slug') ?? '';
  const sessionId = z.uuid().safeParse(q.get('sessionId'));
  if (!sessionId.success) return Response.json({ messages: [] });
  const pub = await getPublicOrg(slug);
  if (!pub) return Response.json({ messages: [] });
  const conv = await findConversation(pub.org.id, sessionId.data);
  if (!conv) return Response.json({ messages: [], status: 'none' });

  const after = q.get('after');
  const since = after && !Number.isNaN(Date.parse(after)) ? new Date(after) : new Date(0);
  const rows = await db
    .select({ id: messages.id, author: messages.author, body: messages.body, createdAt: messages.createdAt })
    .from(messages)
    .where(and(eq(messages.conversationId, conv.id), gt(messages.createdAt, since)))
    .orderBy(asc(messages.createdAt))
    .limit(50);
  return Response.json({ status: conv.status, messages: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })) });
}

export async function POST(request: Request) {
  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'invalid' }, { status: 400 });
  const p = parsed.data;

  const pub = await getPublicOrg(p.slug);
  if (!pub || !pub.modules.has('ai_chat')) return Response.json({ error: 'not_found' }, { status: 404 });
  const { org } = pub;
  const sq = p.locale !== 'en';

  let conv = await findConversation(org.id, p.sessionId);
  if (!conv) {
    [conv] = await db
      .insert(conversations)
      .values({ orgId: org.id, channel: 'web_chat', externalId: `web-${p.sessionId}`, contactName: sq ? 'Vizitor i faqes' : 'Website visitor', language: p.locale, status: 'ai_handling' })
      .returning();
  }
  if (!conv) return Response.json({ error: 'failed' }, { status: 500 });

  if (p.handoff) {
    await db.update(conversations).set({ status: 'needs_human', unreadCount: conv.unreadCount + 1, lastMessageAt: new Date() }).where(eq(conversations.id, conv.id));
    await db.insert(messages).values({ orgId: org.id, conversationId: conv.id, direction: 'inbound', author: 'system', body: sq ? 'Mysafiri kërkoi të flasë me një person.' : 'The guest asked to speak with a person.' });
    return Response.json({ reply: sq ? 'Faleminderit. Një anëtar i ekipit do t’ju përgjigjet shumë shpejt këtu.' : 'Thank you. A team member will reply here very soon.', handoff: true });
  }
  if (!p.message) return Response.json({ error: 'invalid' }, { status: 400 });

  // Per-conversation flood guard (guest messages in the last hour).
  const [flood] = await db
    .select({ n: count() })
    .from(messages)
    .where(and(eq(messages.conversationId, conv.id), eq(messages.author, 'guest'), gte(messages.createdAt, new Date(Date.now() - 3_600_000))));
  if ((flood?.n ?? 0) >= 30) return Response.json({ error: 'rate' }, { status: 429 });

  await db.insert(messages).values({ orgId: org.id, conversationId: conv.id, direction: 'inbound', author: 'guest', body: p.message });
  await db
    .update(conversations)
    .set({ lastMessageAt: new Date(), lastMessagePreview: p.message.slice(0, 120), unreadCount: conv.unreadCount + 1 })
    .where(eq(conversations.id, conv.id));

  // A human has taken over: stay silent, staff will reply from the inbox.
  if (conv.status !== 'ai_handling' || !conv.aiEnabled) return Response.json({ reply: null, human: true });

  if (!aiConfigured()) {
    await db.update(conversations).set({ status: 'needs_human' }).where(eq(conversations.id, conv.id));
    return Response.json({ reply: sq ? 'Asistenti nuk është i disponueshëm tani. Ekipi ynë do t’ju përgjigjet këtu.' : 'The assistant is unavailable. Our team will reply here.', human: true });
  }
  if (!(await takeAiBudget(org.id, null, 'guestchat', 400))) {
    return Response.json({ reply: sq ? 'Jemi shumë të zënë tani. Provoni pas pak ose na shkruani në email.' : 'We are very busy right now. Please try again shortly or email us.' });
  }

  try {
    const { text, handedOff, booking } = await guestAiReply({ pub, conv, message: p.message, locale: p.locale });
    await db.insert(messages).values({ orgId: org.id, conversationId: conv.id, direction: 'outbound', author: 'ai', body: text, aiMeta: { model: 'openrouter' } });
    await db
      .update(conversations)
      .set({ lastMessageAt: new Date(), lastMessagePreview: text.slice(0, 120), ...(handedOff ? { status: 'needs_human' as const } : {}) })
      .where(eq(conversations.id, conv.id));
    return Response.json({ reply: text, handoff: handedOff, booking });
  } catch (e) {
    console.error('[chat]', e);
    await db.update(conversations).set({ status: 'needs_human' }).where(eq(conversations.id, conv.id));
    return Response.json({ reply: sq ? 'Ndodhi një problem teknik. Ekipi ynë do t’ju përgjigjet këtu.' : 'A technical problem occurred. Our team will reply here.', handoff: true });
  }
}
