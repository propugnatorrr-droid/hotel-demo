import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { SettingsView } from '@/components/app/settings/settings-view';
import { requireOrg } from '@/lib/auth/session';
import { getSettings } from '@/server/queries/settings';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ tab?: string }> };

export default async function SettingsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireOrg();
  if (!['owner', 'manager'].includes(ctx.role) && !ctx.profile.isSuperAdmin) notFound();
  const sp = await searchParams;
  const tab = (['hotel', 'ai', 'rooms', 'team'] as const).find((x) => x === sp.tab) ?? 'hotel';
  return <SettingsView data={await getSettings(ctx)} tab={tab} locale={locale} isOwner={ctx.role === 'owner' || ctx.profile.isSuperAdmin} />;
}
