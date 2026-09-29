import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { ChannelsView } from '@/components/app/channels/channels-view';
import { requireOrg } from '@/lib/auth/session';
import { ChannexPanel } from '@/components/app/channels/channex-panel';
import { getChannels } from '@/server/queries/channels';
import { getChannelsOverview } from '@/server/queries/channex';

type Props = { params: Promise<{ locale: string }> };

export default async function ChannelsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireOrg();
  if (!ctx.modules.has('channel_manager') || (!['owner', 'manager'].includes(ctx.role) && !ctx.profile.isSuperAdmin)) notFound();
  const [data, channex] = await Promise.all([getChannels(ctx, locale), getChannelsOverview(ctx)]);
  return (
    <>
      <ChannelsView data={data} locale={locale} />
      <div className="mx-auto mt-16 max-w-6xl border-t border-border pt-10">
        <ChannexPanel data={channex} locale={locale} currency={ctx.org.currency} />
      </div>
    </>
  );
}
