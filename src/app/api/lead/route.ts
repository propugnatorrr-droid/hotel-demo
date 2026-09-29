import { z } from 'zod';
import { BRAND } from '@/config/brand';

export const dynamic = 'force-dynamic';

const body = z.object({
  name: z.string().trim().min(2).max(100),
  hotel: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(6).max(40),
  website: z.string().max(0).optional(), // honeypot
  locale: z.enum(['sq', 'en']).default('sq'),
});

// Best-effort in-memory throttle per instance (5 leads / 10 min / IP).
const hits = new Map<string, number[]>();

/** Marketing-site lead form. Emails the founders through Resend; without RESEND_API_KEY it reports failure so the UI shows the WhatsApp fallback. */
export async function POST(request: Request) {
  const p = body.safeParse(await request.json().catch(() => null));
  if (!p.success) return Response.json({ error: 'invalid' }, { status: 400 });

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 600_000);
  if (recent.length >= 5) return Response.json({ error: 'rate' }, { status: 429 });
  hits.set(ip, [...recent, now]);

  const key = process.env.RESEND_API_KEY;
  const to = process.env.LEAD_EMAIL_TO || BRAND.supportEmail;
  if (!key) return Response.json({ error: 'not_configured' }, { status: 503 });

  const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? 'Iliria <onboarding@resend.dev>',
      to: [to],
      subject: `Lead i ri: ${p.data.hotel}`,
      html: `<p><b>${esc(p.data.name)}</b> · ${esc(p.data.hotel)}</p><p>${esc(p.data.phone)}</p><p>Gjuha: ${p.data.locale}</p>`,
    }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  return res?.ok ? Response.json({ ok: true }) : Response.json({ error: 'send_failed' }, { status: 502 });
}
