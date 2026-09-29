import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { ChannelsWorkspace } from '@/components/app/channels/channels-workspace';
import { requireOrg } from '@/lib/auth/session';
import { getChannelsOverview } from '@/server/queries/channels';

type Props = { params: Promise<{ locale: string }> };

export default async function ChannelsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireOrg();
  const manager = ['owner', 'manager'].includes(ctx.role) || ctx.profile.isSuperAdmin;
  if (!ctx.modules.has('channel_manager') || !manager) notFound();
  const data = await getChannelsOverview(ctx);
  return <ChannelsWorkspace data={data} locale={locale} currency={ctx.org.currency} />;
}
