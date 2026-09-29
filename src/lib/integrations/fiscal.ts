import 'server-only';
import { randomBytes, randomUUID } from 'node:crypto';
import { getIntegration } from './registry';

export type FiscalInput = {
  orgId: string;
  seller: { name: string; nipt: string | null; address: string | null };
  invoice: { number: string; issuedAt: Date; total: number; vatTotal: number; currency: string; buyerName: string | null; buyerNipt: string | null; paymentMethod: string | null };
  lines: { description: string; quantity: number; unitPrice: number; vatRate: number; amount: number }[];
};

export type FiscalResult = { nivf: string; nslf: string; qrUrl: string; provider: string; mode: 'mock' | 'sandbox' | 'live'; response: Record<string, unknown> };

const VERIFY = { live: 'https://efiskalizimi-app.tatime.gov.al/invoice-check/#/verify', test: 'https://efiskalizimi-app-test.tatime.gov.al/invoice-check/#/verify' };

function qr(base: string, iic: string, i: FiscalInput) {
  const p = new URLSearchParams({ iic, tin: i.seller.nipt ?? '', crtd: i.invoice.issuedAt.toISOString(), ord: i.invoice.number.split('/')[0] ?? '', prc: i.invoice.total.toFixed(2) });
  return `${base}?${p.toString()}`;
}

/**
 * Fiscalization adapter (PLAN §8.5). NIVF = IIC (32 hex), NSLF = FIC (uuid).
 *  - mock: generates plausible codes locally. NOT legally valid, labelled as demo.
 *  - sandbox/live: forwards the invoice to the certified provider configured for the hotel.
 *    Each hotel needs its own fiscal certificate with that provider. The request shape follows a generic
 *    JSON contract (FISCAL_API_URL); align field names with the provider's docs when the account is opened.
 */
export async function fiscalizeInvoice(input: FiscalInput): Promise<FiscalResult> {
  const provider = process.env.FISCAL_PROVIDER === 'fature_al' ? 'fature_al' : 'easypos';
  const integ = await getIntegration(input.orgId, provider);
  const url = process.env.FISCAL_API_URL;
  const key = provider === 'fature_al' ? process.env.FATURE_AL_API_KEY : process.env.EASYPOS_API_KEY;

  if (integ.mode === 'mock' || !integ.enabled || !url || !key) {
    const nivf = randomBytes(16).toString('hex').toUpperCase();
    return { nivf, nslf: randomUUID(), qrUrl: qr(VERIFY.test, nivf, input), provider: 'mock', mode: 'mock', response: { mock: true } };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      environment: integ.mode === 'live' ? 'production' : 'test',
      seller: input.seller,
      invoice: { ...input.invoice, issuedAt: input.invoice.issuedAt.toISOString() },
      lines: input.lines,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const json = (await res.json().catch(() => ({}))) as { nivf?: string; iic?: string; nslf?: string; fic?: string; qr?: string; error?: string };
  const nivf = json.nivf ?? json.iic;
  const nslf = json.nslf ?? json.fic;
  if (!res.ok || !nivf || !nslf) throw new Error(json.error ?? `Fiscal provider ${res.status}`);
  return { nivf, nslf, qrUrl: json.qr ?? qr(integ.mode === 'live' ? VERIFY.live : VERIFY.test, nivf, input), provider, mode: integ.mode, response: json as Record<string, unknown> };
}
