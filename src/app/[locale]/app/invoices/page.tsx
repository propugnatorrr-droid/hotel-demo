import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { InvoicesView } from '@/components/app/invoices/invoices-view';
import { requireOrg } from '@/lib/auth/session';
import { getCash, getInvoice, getInvoiceCounts, getInvoiceable, INVOICE_STATUSES, listInvoices } from '@/server/queries/invoices';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ tab?: string; filter?: string; q?: string; i?: string }> };

export default async function InvoicesPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireOrg();
  if (!ctx.modules.has('invoicing') || (!['owner', 'manager', 'receptionist', 'accountant'].includes(ctx.role) && !ctx.profile.isSuperAdmin)) notFound();

  const sp = await searchParams;
  const tab = sp.tab === 'cash' ? 'cash' : 'invoices';
  const filter = (INVOICE_STATUSES as readonly string[]).includes(sp.filter ?? '') ? (sp.filter as string) : 'all';
  const q = (sp.q ?? '').slice(0, 80);

  const [rows, counts, detail, invoiceable, cash] = await Promise.all([
    tab === 'invoices' ? listInvoices(ctx, filter, q) : Promise.resolve([]),
    getInvoiceCounts(ctx),
    getInvoice(ctx, sp.i),
    getInvoiceable(ctx),
    getCash(ctx),
  ]);
  return (
    <InvoicesView tab={tab} rows={rows} counts={counts} filter={filter} q={q} detail={detail} invoiceable={invoiceable} cash={cash} locale={locale} currency={ctx.org.currency} manager={['owner', 'manager'].includes(ctx.role) || ctx.profile.isSuperAdmin} />
  );
}
