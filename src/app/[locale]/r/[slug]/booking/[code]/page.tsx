import { and, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import Link from 'next/link';
import { db } from '@/db';
import { bookings, guests, roomTypes } from '@/db/schema';
import { pickResortCopy } from '@/components/resort/copy';
import { diffDays, formatDay } from '@/lib/dates';
import { formatCurrency } from '@/lib/format';
import { createCheckout } from '@/lib/integrations/payments';
import { localized } from '@/lib/utils';
import { getPublicOrg, verifyBooking } from '@/server/services/public-site';

type Props = { params: Promise<{ locale: string; slug: string; code: string }>; searchParams: Promise<{ t?: string; paid?: string }> };

export const dynamic = 'force-dynamic';

export default async function BookingConfirmation({ params, searchParams }: Props) {
  const { locale, slug, code } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const pub = await getPublicOrg(slug);
  if (!pub || !sp.t || !verifyBooking(code, sp.t)) notFound();
  const { org } = pub;
  const t = pickResortCopy(locale).confirmation;

  const [b] = await db
    .select({ b: bookings, first: guests.firstName, type: roomTypes.name })
    .from(bookings)
    .innerJoin(guests, eq(guests.id, bookings.guestId))
    .innerJoin(roomTypes, eq(roomTypes.id, bookings.roomTypeId))
    .where(and(eq(bookings.orgId, org.id), eq(bookings.code, code)))
    .limit(1);
  if (!b) notFound();

  const money = (n: number) => formatCurrency(n, b.b.currency, locale, 0);
  const due = Math.max(0, b.b.totalAmount - b.b.paidAmount);
  const depositDue = b.b.status === 'tentative' ? Math.max(0, (b.b.depositAmount || b.b.totalAmount) - b.b.paidAmount) : 0;
  const checkout = depositDue > 0
    ? await createCheckout({ orgId: org.id, slug, locale, code, token: sp.t, amount: depositDue, currency: b.b.currency, description: org.name })
    : null;
  const home = locale === 'en' ? `/en/r/${slug}` : `/r/${slug}`;

  return (
    <main data-theme="day" className="relative grid min-h-dvh place-items-center overflow-hidden bg-limestone-100 px-4 py-16 text-ionian-950">
      <div className="bg-qilim pointer-events-none absolute inset-0 opacity-50" />
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-limestone-200 bg-white shadow-float">
        <div className="bg-ionian-950 px-8 py-10 text-limestone-50">
          <p className="text-xs tracking-[0.3em] text-gold-400 uppercase">{org.name}</p>
          <h1 className="font-display mt-3 text-5xl">{t.thanks}, {b.first}.</h1>
          <p className="mt-2 text-sm text-ionian-200">{t.status[b.b.status]}</p>
        </div>
        {sp.paid && <p className="bg-success-soft px-8 py-3 text-sm text-success">{t.paidBanner}</p>}
        <dl className="space-y-3 px-8 py-6 text-sm">
          {[
            [t.code, b.b.code],
            [t.stay, `${formatDay(b.b.checkIn, locale, { day: 'numeric', month: 'short' })} → ${formatDay(b.b.checkOut, locale, { day: 'numeric', month: 'short', year: 'numeric' })} · ${diffDays(b.b.checkOut, b.b.checkIn)}`],
            [localized(b.type, locale), `${b.b.adults + b.b.children} ${t.guests.toLowerCase()}`],
            [t.total, money(b.b.totalAmount)],
            [t.paid, money(b.b.paidAmount)],
            [t.due, money(due)],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 border-b border-limestone-200 pb-3"><dt className="text-limestone-600">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
          ))}
        </dl>
        <div className="flex flex-col gap-2 px-8 pb-8">
          {checkout && <a href={checkout.url} className="grid h-11 place-items-center rounded-full bg-gold-400 text-sm font-semibold text-ionian-950">{t.payNow} · {money(depositDue)}</a>}
          <Link href={home} className="grid h-11 place-items-center rounded-full border border-limestone-300 text-sm">{t.back}</Link>
          {org.phone && <p className="pt-2 text-center text-xs text-limestone-600">{t.contact}: {org.phone}{org.email ? ` · ${org.email}` : ''}</p>}
        </div>
      </div>
    </main>
  );
}
