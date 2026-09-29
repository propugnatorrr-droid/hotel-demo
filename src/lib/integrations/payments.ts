import 'server-only';
import { createHash } from 'node:crypto';
import { env } from '@/lib/env';
import { getIntegration } from './registry';

export type Checkout = { url: string; mode: 'mock' | 'sandbox' | 'live'; providerRef: string };

const md5 = (s: string) => createHash('md5').update(s).digest('hex');
const b64url = (s: string) => Buffer.from(s).toString('base64').replaceAll('+', '-').replaceAll('/', '_');
const fromB64url = (s: string) => Buffer.from(s.replaceAll('-', '+').replaceAll('_', '/'), 'base64').toString('utf8');

/**
 * Payment adapter (PLAN §8.4). Stripe does not operate in Albania, so:
 *  - mock    → internal demo checkout page (no network)
 *  - sandbox → Paysera with test=1
 *  - live    → Paysera
 */
export async function createCheckout(input: {
  orgId: string;
  slug: string;
  locale: string;
  code: string;
  token: string;
  amount: number;
  currency: 'ALL' | 'EUR' | 'USD';
  description: string;
  email?: string;
}): Promise<Checkout> {
  const integ = await getIntegration(input.orgId, 'paysera');
  const prefix = input.locale === 'en' ? '/en' : '';
  const base = `${env.NEXT_PUBLIC_APP_URL}${prefix}/r/${input.slug}`;
  const project = process.env.PAYSERA_PROJECT_ID;
  const password = process.env.PAYSERA_SIGN_PASSWORD;

  if (integ.mode === 'mock' || !integ.enabled || !project || !password) {
    return { url: `${base}/pay/${input.code}?t=${input.token}`, mode: 'mock', providerRef: `mock-${input.code}` };
  }

  const params = new URLSearchParams({
    projectid: project,
    orderid: input.code,
    accepturl: `${base}/booking/${input.code}?t=${input.token}&paid=1`,
    cancelurl: `${base}/booking/${input.code}?t=${input.token}`,
    callbackurl: `${env.NEXT_PUBLIC_APP_URL}/api/webhooks/paysera`,
    version: '1.6',
    amount: String(Math.round(input.amount * 100)),
    currency: input.currency,
    p_email: input.email ?? '',
    lang: input.locale === 'en' ? 'ENG' : 'ALB',
    test: integ.mode === 'sandbox' ? '1' : '0',
  });
  const data = b64url(params.toString());
  const sign = md5(data + password);
  return { url: `https://www.paysera.com/pay/?data=${data}&sign=${sign}`, mode: integ.mode, providerRef: input.code };
}

/** Verifies a Paysera callback (`data` + `ss1`) and returns the payment fields. */
export function verifyPayseraCallback(data: string, ss1: string) {
  const password = process.env.PAYSERA_SIGN_PASSWORD;
  if (!password || md5(data + password) !== ss1) return null;
  const q = new URLSearchParams(fromB64url(data));
  return {
    orderId: q.get('orderid') ?? '',
    status: q.get('status') ?? '',
    amount: Number(q.get('amount') ?? '0') / 100,
    currency: q.get('currency') ?? '',
    requestId: q.get('requestid') ?? '',
    test: q.get('test') === '1',
  };
}
