import { verifyPayseraCallback } from '@/lib/integrations/payments';
import { applyOnlinePayment } from '@/server/services/public-site';

export const dynamic = 'force-dynamic';

/** Paysera server-to-server callback. Answers "OK" only after a verified, applied payment. */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const cb = verifyPayseraCallback(q.get('data') ?? '', q.get('ss1') ?? '');
  if (!cb) return new Response('bad signature', { status: 400 });
  if (cb.status !== '1') return new Response('OK'); // not paid (yet): acknowledge without applying
  const r = await applyOnlinePayment({ code: cb.orderId, amount: cb.amount, providerRef: `paysera-${cb.requestId || cb.orderId}` });
  return r.ok ? new Response('OK') : new Response('unknown order', { status: 404 });
}
