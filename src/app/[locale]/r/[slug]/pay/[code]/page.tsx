import { and, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { db } from '@/db';
import { bookings } from '@/db/schema';
import { MockPayButton } from '@/components/resort/mock-pay-button';
import { pickResortCopy } from '@/components/resort/copy';
import { formatCurrency } from '@/lib/format';
import { getPublicOrg, verifyBooking } from '@/server/services/public-site';

type Props = { params: Promise<{ locale: string; slug: string; code: string }>; searchParams: Promise<{ t?: string }> };

export const dynamic = 'force-dynamic';

/** Internal demo checkout used while the payments integration runs in mock mode. */
export default async function MockCheckout({ params, searchParams }: Props) {
  const { locale, slug, code } = await params;
  const { t: token } = await searchParams;
  setRequestLocale(locale);
  const pub = await getPublicOrg(slug);
  if (!pub || !token || !verifyBooking(code, token)) notFound();
  const [b] = await db.select().from(bookings).where(and(eq(bookings.orgId, pub.org.id), eq(bookings.code, code))).limit(1);
  if (!b) notFound();
  const t = pickResortCopy(locale).pay;
  const due = Math.max(0, (b.depositAmount || b.totalAmount) - b.paidAmount);

  return (
    <main data-theme="day" className="relative grid min-h-dvh place-items-center bg-limestone-100 px-4 text-ionian-950">
      <div className="bg-qilim pointer-events-none absolute inset-0 opacity-50" />
      <div className="relative w-full max-w-md rounded-3xl border border-limestone-200 bg-white p-8 shadow-float">
        <p className="text-xs tracking-[0.3em] text-accent uppercase">{pub.org.name}</p>
        <h1 className="font-display mt-2 text-4xl">{t.title}</h1>
        <p className="mt-4 rounded-lg bg-gold-100 px-3 py-2 text-xs text-limestone-800">{t.demo}</p>
        <p className="mt-6 text-sm text-limestone-600">{t.amount}</p>
        <p className="font-serif text-6xl tabular-nums">{formatCurrency(due, b.currency, locale, 2)}</p>
        <MockPayButton slug={slug} code={code} token={token} locale={locale} label={t.pay} busy={t.paying} disabled={due <= 0} />
      </div>
    </main>
  );
}
