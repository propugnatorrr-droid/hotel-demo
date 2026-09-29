import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { GuestProfileView } from '@/components/app/guests/guest-profile';
import { requireOrg } from '@/lib/auth/session';
import { getGuestProfile } from '@/server/queries/guest-profile';

type Props = { params: Promise<{ locale: string; id: string }> };

export default async function GuestProfilePage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const ctx = await requireOrg();
  if (!ctx.modules.has('pms') || (!['owner', 'manager', 'receptionist'].includes(ctx.role) && !ctx.profile.isSuperAdmin)) notFound();
  const data = await getGuestProfile(ctx, id, locale);
  if (!data) notFound();
  return <GuestProfileView data={data} locale={locale} currency={ctx.org.currency} canManage={['owner', 'manager'].includes(ctx.role) || ctx.profile.isSuperAdmin} />;
}
