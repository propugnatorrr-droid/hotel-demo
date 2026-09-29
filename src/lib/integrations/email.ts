import 'server-only';
import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { getIntegration } from './registry';

/** Email adapter: mock logs to audit_logs, live sends through Resend. Never throws. */
export async function sendEmail(input: { orgId: string; to: string; subject: string; html: string; from?: string }) {
  try {
    const integ = await getIntegration(input.orgId, 'resend');
    const key = process.env.RESEND_API_KEY;
    if (integ.mode === 'mock' || !integ.enabled || !key) {
      await db.insert(auditLogs).values({
        orgId: input.orgId,
        action: 'email.mock',
        entityType: 'email',
        meta: { to: input.to, subject: input.subject },
      });
      return { ok: true as const, mock: true };
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: input.from ?? process.env.EMAIL_FROM ?? 'Iliria <onboarding@resend.dev>',
        to: [input.to],
        subject: input.subject,
        html: input.html,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}`);
    return { ok: true as const, mock: false };
  } catch (e) {
    console.error('[email]', e);
    return { ok: false as const, mock: false };
  }
}

export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
