import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { PrintButton } from '@/components/app/invoices/print-button';
import { requireOrg } from '@/lib/auth/session';
import { addDays, formatDay, todayIn } from '@/lib/dates';
import { formatCurrency } from '@/lib/format';
import { getReport } from '@/server/queries/reports';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ from?: string; to?: string }> };

export const dynamic = 'force-dynamic';

/** A4 report for Save as PDF: KPIs, channels, outlets and expenses. */
export default async function PrintReport({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireOrg();
  if (!ctx.modules.has('reports') || !['owner', 'manager', 'accountant'].includes(ctx.role)) notFound();
  const sp = await searchParams;
  const today = todayIn(ctx.org.timezone);
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  const from = iso.test(sp.from ?? '') ? sp.from! : addDays(today, -29);
  const to = iso.test(sp.to ?? '') ? sp.to! : today;
  const d = await getReport(ctx, from, to, null);
  const en = locale === 'en';
  const money = (n: number) => formatCurrency(n, ctx.org.currency, locale, 0);
  const s = d.stats;

  return (
    <main data-theme="day" className="mx-auto min-h-dvh max-w-3xl bg-white p-10 text-ionian-950 print:p-0">
      <div className="mb-6 flex justify-end print:hidden"><PrintButton label={en ? 'Print / Save PDF' : 'Printo / Ruaj PDF'} /></div>
      <h1 className="font-display text-4xl">{ctx.org.name}</h1>
      <p className="text-sm text-limestone-700">{en ? 'Report' : 'Raport'} · {formatDay(from, locale, { day: 'numeric', month: 'long', year: 'numeric' })} → {formatDay(to, locale, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      <div className="mt-6 grid grid-cols-3 gap-4">
        {[[en ? 'Revenue' : 'Të ardhura', money(s.totalRevenue)], [en ? 'Occupancy' : 'Pushtimi', `${s.occupancy}%`], ['ADR', money(s.adr)], ['RevPAR', money(s.revpar)], [en ? 'New bookings' : 'Rezervime të reja', String(s.newBookings)], [en ? 'Cancellations' : 'Anulime', String(s.cancellations)]].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-limestone-300 p-3"><p className="text-xs text-limestone-600">{k}</p><p className="font-serif text-3xl">{v}</p></div>
        ))}
      </div>
      <h2 className="font-display mt-8 text-2xl">{en ? 'Revenue split' : 'Të ardhurat sipas llojit'}</h2>
      <table className="mt-2 w-full text-sm"><tbody>
        {[[en ? 'Rooms' : 'Dhoma', s.roomRevenue], [en ? 'Restaurant & bar' : 'Restorant & bar', s.fbRevenue], ['Spa', s.spaRevenue]].map(([k, v]) => <tr key={String(k)} className="border-b border-limestone-200"><td className="py-1.5">{k}</td><td className="py-1.5 text-right tabular-nums">{money(Number(v))}</td></tr>)}
      </tbody></table>
      <h2 className="font-display mt-8 text-2xl">{en ? 'Channels' : 'Kanalet'}</h2>
      <table className="mt-2 w-full text-sm"><tbody>{d.channels.map((c) => <tr key={c.source} className="border-b border-limestone-200"><td className="py-1.5">{c.source}</td><td className="py-1.5 text-right tabular-nums">{c.bookings}</td><td className="py-1.5 text-right tabular-nums">{money(c.revenue)}</td></tr>)}</tbody></table>
      <h2 className="font-display mt-8 text-2xl">{en ? 'Expenses' : 'Shpenzimet'}</h2>
      <table className="mt-2 w-full text-sm"><tbody>{d.expenses.byDepartment.map((e) => <tr key={e.dept} className="border-b border-limestone-200"><td className="py-1.5">{e.dept}</td><td className="py-1.5 text-right tabular-nums">{money(e.total)}</td></tr>)}
        <tr className="font-semibold"><td className="py-2">{en ? 'Profit' : 'Fitimi'}</td><td className="py-2 text-right tabular-nums">{money(s.totalRevenue - d.expenses.total)}</td></tr></tbody></table>
    </main>
  );
}
