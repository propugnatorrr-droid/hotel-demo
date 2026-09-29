import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { GuestsDirectory } from '@/components/app/guests/guests-directory';
import { requireOrg } from '@/lib/auth/session';
import { getGuestDetail, listGuests } from '@/server/queries/guests';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; g?: string }>;
};

export default async function GuestsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireOrg();
  if (!ctx.modules.has('pms') || (!['owner', 'manager', 'receptionist'].includes(ctx.role) && !ctx.profile.isSuperAdmin)) {
    notFound();
  }
  const sp = await searchParams;
  const q = (sp.q ?? '').slice(0, 80);
  const [rows, detail] = await Promise.all([listGuests(ctx, q), getGuestDetail(ctx, sp.g)]);

  return <GuestsDirectory rows={rows} q={q} detail={detail} locale={locale} currency={ctx.org.currency} />;
}
