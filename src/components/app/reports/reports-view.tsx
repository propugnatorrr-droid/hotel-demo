import Link from 'next/link';
import { Download, Printer, TrendingDown, TrendingUp } from 'lucide-react';
import { PageHero } from '@/components/app/page-hero';
import { SOURCE_COLOR, type BookingSource } from '@/config/channels';
import { auditLabel } from '@/config/audit-labels';
import { formatDay, relativeTime } from '@/lib/dates';
import { formatCurrency, type Currency } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ReportData } from '@/server/queries/reports';
import { pickReportsCopy } from './copy';

const pct = (a: number, b: number) => (b === 0 ? null : Math.round(((a - b) / b) * 100));

export function ReportsView({ data, locale, currency, preset, userId, mounted }: { data: ReportData; locale: string; currency: Currency; preset: string; userId: string | null; mounted: string }) {
  const t = pickReportsCopy(locale);
  const money = (n: number) => formatCurrency(n, currency, locale, 0);
  const { stats: s, before: b } = data;
  const base = `/${locale === 'en' ? 'en/' : ''}app/reports`;
  const qs = (o: Record<string, string | null>) => {
    const p = new URLSearchParams({ from: data.from, to: data.to });
    if (userId) p.set('user', userId);
    for (const [k, v] of Object.entries(o)) v === null ? p.delete(k) : p.set(k, v);
    return `${base}?${p}`;
  };

  const kpis = [
    { k: 'revenue', v: money(s.totalRevenue), d: pct(s.totalRevenue, b.totalRevenue), help: null },
    { k: 'occupancy', v: `${s.occupancy}%`, d: pct(s.occupancy, b.occupancy), help: t.kpiHelp.occupancy },
    { k: 'adr', v: money(s.adr), d: pct(s.adr, b.adr), help: t.kpiHelp.adr },
    { k: 'revpar', v: money(s.revpar), d: pct(s.revpar, b.revpar), help: t.kpiHelp.revpar },
    { k: 'bookings', v: String(s.newBookings), d: pct(s.newBookings, b.newBookings), help: null },
    { k: 'cancellations', v: String(s.cancellations), d: pct(s.cancellations, b.cancellations), help: null, invert: true },
  ] as const;

  const max = Math.max(1, ...data.series.map((d) => d.total));
  const chMax = Math.max(1, ...data.channels.map((c) => c.revenue));
  const profit = s.totalRevenue - data.expenses.total;
  const stack = data.series.length > 45 ? data.series.filter((_, i) => i % Math.ceil(data.series.length / 45) === 0) : data.series;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHero
        eyebrow={t.eyebrow}
        title={t.title}
        subtitle={t.subtitle}
        actions={
          <Link href={`/${locale === 'en' ? 'en/' : ''}print/report?from=${data.from}&to=${data.to}`} target="_blank" className="inline-flex h-10 items-center gap-2 rounded-full bg-limestone-50 px-5 text-sm font-medium text-ionian-950"><Printer className="size-4" /> {t.pdf}</Link>
        }
      >
        <div className="relative mt-8 flex flex-wrap items-center gap-2">
          {(['7', '30', 'month', 'lastMonth', 'ytd'] as const).map((p) => (
            <Link key={p} href={`${base}?preset=${p}`} className={cn('inline-flex h-9 items-center rounded-full px-4 text-xs', preset === p ? 'bg-limestone-50 font-medium text-ionian-950' : 'bg-white/10 text-ionian-100 hover:bg-white/15')}>{t.presets[p]}</Link>
          ))}
          <form action={base} method="get" className="ml-auto flex items-center gap-2 text-xs text-ionian-100">
            <input type="date" name="from" defaultValue={data.from} className="h-9 rounded-full border border-white/15 bg-white/10 px-3 text-limestone-50" />
            <span>→</span>
            <input type="date" name="to" defaultValue={data.to} className="h-9 rounded-full border border-white/15 bg-white/10 px-3 text-limestone-50" />
            <button type="submit" className="h-9 rounded-full bg-gold-400 px-4 font-medium text-ionian-950">{t.apply}</button>
          </form>
        </div>
      </PageHero>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        {kpis.map((k) => {
          const good = k.d === null ? null : ('invert' in k && k.invert ? k.d <= 0 : k.d >= 0);
          return (
            <div key={k.k} className="animate-fade-up rounded-xl border border-border bg-surface p-4 shadow-soft" title={k.help ?? undefined}>
              <p className="text-xs text-muted">{t.kpi[k.k]}</p>
              <p className="font-serif text-4xl tabular-nums">{k.v}</p>
              {k.d !== null && (
                <p className={cn('mt-1 inline-flex items-center gap-1 text-xs', good ? 'text-success' : 'text-danger')}>
                  {k.d >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                  {k.d > 0 ? '+' : ''}{k.d}% <span className="text-subtle">{t.vsPrev}</span>
                </p>
              )}
              {k.help && <p className="mt-1 text-[11px] text-subtle">{k.help}</p>}
            </div>
          );
        })}
      </div>

      <section className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-2xl">{t.revenueByDay}</h2>
          <div className="flex gap-3 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-ionian-500" />{t.rooms}</span>
            <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-gold-500" />{t.fb}</span>
            <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-olive-500" />{t.spa}</span>
          </div>
        </div>
        <div className="mt-5 flex h-52 items-end gap-1">
          {stack.map((d) => (
            <div key={d.day} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end" title={`${formatDay(d.day, locale, { day: 'numeric', month: 'short' })}: ${money(d.total)}`}>
              <div className="flex w-full flex-col-reverse overflow-hidden rounded-t transition-opacity group-hover:opacity-80" style={{ height: `${(d.total / max) * 100}%` }}>
                <div className="bg-ionian-500" style={{ flex: d.rooms }} />
                <div className="bg-gold-500" style={{ flex: d.fb }} />
                <div className="bg-olive-500" style={{ flex: d.spa }} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-subtle"><span>{formatDay(data.from, locale, { day: 'numeric', month: 'short' })}</span><span>{formatDay(data.to, locale, { day: 'numeric', month: 'short' })}</span></div>
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
          <h2 className="font-display text-2xl">{t.channels}</h2>
          {data.channels.length === 0 ? <p className="py-8 text-center text-sm text-muted">{t.empty}</p> : (
            <ul className="mt-4 space-y-3">
              {data.channels.map((c) => (
                <li key={c.source} className="text-sm">
                  <div className="flex items-baseline justify-between"><span className="inline-flex items-center gap-2"><i className="size-2.5 rounded-full" style={{ background: SOURCE_COLOR[c.source as BookingSource] }} />{t.source[c.source] ?? c.source}</span><span className="tabular-nums">{money(c.revenue)}</span></div>
                  <div className="mt-1 h-1.5 rounded-full bg-surface-2"><div className="h-full rounded-full" style={{ width: `${(c.revenue / chMax) * 100}%`, background: SOURCE_COLOR[c.source as BookingSource] }} /></div>
                  <p className="mt-0.5 text-[11px] text-subtle">{c.bookings} {t.channelCols.bookings.toLowerCase()} · {c.nights} {t.channelCols.nights.toLowerCase()}{c.commission > 0 ? ` · ${t.channelCols.commission.toLowerCase()} ${money(c.commission)}` : ''}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
          <h2 className="font-display text-2xl">{t.outlets}</h2>
          {data.outlets.length === 0 ? <p className="py-8 text-center text-sm text-muted">{t.empty}</p> : (
            <ul className="mt-4 divide-y divide-border">{data.outlets.map((o) => <li key={o.outlet} className="flex items-baseline justify-between py-2.5 text-sm"><span>{o.outlet} <span className="text-xs text-subtle">· {o.orders}</span></span><span className="tabular-nums">{money(o.total)}</span></li>)}</ul>
          )}
          <h2 className="font-display mt-6 text-2xl">{t.expenses}</h2>
          <ul className="mt-3 divide-y divide-border">{data.expenses.byDepartment.map((e) => <li key={e.dept} className="flex justify-between py-2 text-sm"><span>{e.dept}</span><span className="tabular-nums">{money(e.total)}</span></li>)}</ul>
          <div className="mt-4 flex items-baseline justify-between rounded-xl bg-surface-2 px-4 py-3"><span className="text-sm">{t.profit}</span><span className={cn('font-serif text-3xl tabular-nums', profit >= 0 ? 'text-success' : 'text-danger')}>{money(profit)}</span></div>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-border bg-surface p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-2xl">{t.export}</h2>
          <div className="flex flex-wrap gap-2">
            {(['bookings', 'invoices', 'expenses', 'payments', 'activity'] as const).map((k) => (
              <a key={k} href={`/api/export/${k}?from=${data.from}&to=${data.to}&locale=${locale}`} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border-strong px-4 text-xs hover:bg-surface-2"><Download className="size-3.5" />{t.exportKinds[k]}</a>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-6 mb-10 overflow-hidden rounded-2xl border border-border bg-surface shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-5">
          <h2 className="font-display text-2xl">{t.activity}</h2>
          <form action={base} method="get" className="flex items-center gap-2">
            <input type="hidden" name="from" value={data.from} /><input type="hidden" name="to" value={data.to} />
            <select name="user" defaultValue={userId ?? ''} className="h-9 rounded-full border border-border-strong bg-surface px-3 text-xs">
              <option value="">{t.allStaff}</option>
              {data.activity.staff.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <button className="h-9 rounded-full bg-ionian-900 px-4 text-xs text-limestone-50">{t.apply}</button>
          </form>
        </div>
        <ul className="divide-y divide-border">
          {data.activity.rows.length === 0 && <li className="py-10 text-center text-sm text-muted">{t.empty}</li>}
          {data.activity.rows.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-2 text-[11px] font-medium">{(a.name ?? 'S').slice(0, 1)}</span>
              <span className="min-w-0 flex-1 truncate"><b className="font-medium">{a.name ?? t.system}</b> · {auditLabel(a.action, locale)}</span>
              <span className="text-xs text-subtle">{relativeTime(new Date(a.createdAt), locale, new Date(mounted))}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
