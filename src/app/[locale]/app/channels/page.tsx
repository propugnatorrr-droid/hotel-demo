import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { ChannelsView } from '@/components/app/channels/channels-view';
import { requireOrg } from '@/lib/auth/session';
import { getChannels } from '@/server/queries/channels';

type Props = { params: Promise<{ locale: string }> };

export default async function ChannelsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireOrg();
  if (!ctx.modules.has('channel_manager') || (!['owner', 'manager'].includes(ctx.role) && !ctx.profile.isSuperAdmin)) notFound();
  return <ChannelsView data={await getChannels(ctx, locale)} locale={locale} />;
}
