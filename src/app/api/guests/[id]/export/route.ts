import { requireOrg } from '@/lib/auth/session';
import { db } from '@/db';
import { auditLogs } from '@/db/schema';
import { getGuestProfile } from '@/server/queries/guest-profile';

export const dynamic = 'force-dynamic';

/** GDPR access / portability export (Art. 15 + 20): everything held about one guest, as JSON. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireOrg();
  if (!['owner', 'manager', 'receptionist'].includes(ctx.role) && !ctx.profile.isSuperAdmin) return new Response('Forbidden', { status: 403 });
  const { id } = await params;
  const p = await getGuestProfile(ctx, id, 'en');
  if (!p) return new Response('Not found', { status: 404 });
  await db.insert(auditLogs).values({ orgId: ctx.org.id, userId: ctx.user.id, action: 'guest.exported', entityType: 'guest', entityId: id, meta: {} });
  const body = JSON.stringify({ exportedAt: new Date().toISOString(), controller: ctx.org.legalName ?? ctx.org.name, guest: p.guest, stays: p.stayList, spend: p.spend, conversations: p.conversations, notes: p.notes.map((n) => ({ text: n.text, at: n.at })) }, null, 2);
  const file = `${p.guest.lastName}-${p.guest.firstName}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  return new Response(body, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="guest-${file}.json"`, 'Cache-Control': 'no-store' } });
}
