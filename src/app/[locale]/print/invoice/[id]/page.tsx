import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { PrintButton } from '@/components/app/invoices/print-button';
import { requireOrg } from '@/lib/auth/session';
import { formatDay } from '@/lib/dates';
import { formatCurrency } from '@/lib/format';
import { getInvoice } from '@/server/queries/invoices';

type Props = { params: Promise<{ locale: string; id: string }> };

export const dynamic = 'force-dynamic';

/** Clean A4 layout. Use the browser's Save as PDF. */
export default async function PrintInvoice({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const ctx = await requireOrg();
  if (!ctx.modules.has('invoicing') || !['owner', 'manager', 'receptionist', 'accountant'].includes(ctx.role)) notFound();
  const inv = await getInvoice(ctx, id);
  if (!inv) notFound();
  const en = locale === 'en';
  const money = (n: number) => formatCurrency(n, inv.currency, locale, 2);

  return (
    <main data-theme="day" className="mx-auto min-h-dvh max-w-3xl bg-white p-10 text-ionian-950 print:p-0">
      <div className="mb-6 flex justify-end print:hidden"><PrintButton label={en ? 'Print / Save PDF' : 'Printo / Ruaj PDF'} /></div>
      <header className="flex items-start justify-between border-b border-limestone-300 pb-6">
        <div>
          <h1 className="font-display text-4xl">{inv.seller.name}</h1>
          <p className="mt-1 text-sm text-limestone-700">{inv.seller.address}</p>
          <p className="text-sm text-limestone-700">NIPT: {inv.seller.nipt}</p>
          <p className="text-sm text-limestone-700">{[inv.seller.phone, inv.seller.email].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="text-right">
          <p className="text-xs tracking-widest text-limestone-600 uppercase">{en ? 'Invoice' : 'Faturë'}</p>
          <p className="font-mono text-2xl">#{inv.number}</p>
          <p className="text-sm text-limestone-700">{formatDay(inv.issuedAt.slice(0, 10), locale, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        </div>
      </header>
      <section className="mt-6 text-sm"><p className="text-xs tracking-widest text-limestone-600 uppercase">{en ? 'Buyer' : 'Blerësi'}</p><p className="mt-1 font-medium">{inv.buyerName ?? (en ? 'Walk-in customer' : 'Klient pa emër')}</p>{inv.buyerNipt && <p>NIPT: {inv.buyerNipt}</p>}{inv.buyerAddress && <p>{inv.buyerAddress}</p>}</section>
      <table className="mt-8 w-full text-sm">
        <thead><tr className="border-b border-limestone-300 text-left text-xs tracking-wider text-limestone-600 uppercase"><th className="py-2">{en ? 'Description' : 'Përshkrimi'}</th><th className="py-2 text-right">{en ? 'Qty' : 'Sasia'}</th><th className="py-2 text-right">{en ? 'Price' : 'Çmimi'}</th><th className="py-2 text-right">TVSH</th><th className="py-2 text-right">{en ? 'Amount' : 'Shuma'}</th></tr></thead>
        <tbody>{inv.lines.map((l) => <tr key={l.id} className="border-b border-limestone-200"><td className="py-2">{l.description}</td><td className="py-2 text-right tabular-nums">{l.quantity}</td><td className="py-2 text-right tabular-nums">{money(l.unitPrice)}</td><td className="py-2 text-right tabular-nums">{l.vatRate}%</td><td className="py-2 text-right tabular-nums">{money(l.amount)}</td></tr>)}</tbody>
      </table>
      <div className="mt-6 ml-auto w-64 space-y-1 text-sm">
        <p className="flex justify-between"><span>{en ? 'Net' : 'Pa TVSH'}</span><span className="tabular-nums">{money(inv.subtotal)}</span></p>
        {inv.vatBreakdown.map((v) => <p key={v.rate} className="flex justify-between text-limestone-700"><span>TVSH {v.rate}%</span><span className="tabular-nums">{money(v.vat)}</span></p>)}
        <p className="flex justify-between border-t border-limestone-300 pt-2 text-lg font-semibold"><span>Total</span><span className="tabular-nums">{money(inv.total)}</span></p>
      </div>
      {inv.status === 'fiscalized' && (
        <footer className="mt-10 flex items-center gap-5 border-t border-limestone-300 pt-6 text-xs">
          {inv.qr && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={inv.qr} alt="QR" className="size-28" />
          )}
          <div className="space-y-1"><p><b>NIVF:</b> <span className="font-mono">{inv.nivf}</span></p><p><b>NSLF:</b> <span className="font-mono">{inv.nslf}</span></p>{inv.fiscalProvider === 'mock' && <p className="text-limestone-600">{en ? 'Demo codes, no legal effect.' : 'Kode demo, pa vlerë ligjore.'}</p>}</div>
        </footer>
      )}
      {inv.status === 'cancelled' && <p className="mt-8 text-center text-3xl font-bold text-terracotta-500 uppercase">{en ? 'Cancelled' : 'Anuluar'}</p>}
    </main>
  );
}
