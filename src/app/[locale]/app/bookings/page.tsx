import Link from 'next/link';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { ArrowUpRight, CalendarDays, Plus } from 'lucide-react';
import { requireOrg } from '@/lib/auth/session';
import { todayIn } from '@/lib/dates';
import { getFrontDesk } from '@/server/queries/front-desk';
import { createBooking } from '@/server/actions/front-desk';

type Props = { params: Promise<{ locale: string }> };

export default async function BookingsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const ctx = await requireOrg();
  if (!ctx.modules.has('pms') || !['owner', 'manager', 'receptionist'].includes(ctx.role)) {
    notFound();
  }

  const data = await getFrontDesk(ctx);
  const en = locale === 'en';
  const today = todayIn(ctx.org.timezone);
  const prefix = en ? '/en' : '';

  const upcoming = data.bookings.filter((b) =>
    ['confirmed', 'tentative'].includes(b.status) && b.checkOut > today
  );
  const inHouse = data.bookings.filter((b) => b.status === 'checked_in');

  return (
    <main className="mx-auto max-w-7xl space-y-7">
      <header className="relative overflow-hidden rounded-2xl bg-ionian-950 px-7 py-10 text-limestone-50 md:px-12 md:py-14">
        <div className="pointer-events-none absolute -right-12 -top-36 size-96 rounded-full border-[48px] border-ionian-500/20" />
        <p className="flex items-center gap-2 text-xs tracking-[0.25em] text-gold-400 uppercase">
          <CalendarDays className="size-4" />
          {en ? 'Front desk · live register' : 'Recepsioni · regjistri i
