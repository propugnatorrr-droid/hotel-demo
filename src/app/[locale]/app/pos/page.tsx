import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { PosTerminal } from '@/components/app/pos/pos-terminal';
import { requireOrg } from '@/lib/auth/session';
import { getPos } from '@/server/queries/pos';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ outlet?: string }> };

export default async function PosPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireOrg();
  if (!ctx.modules.has('pos') || (!['owner', 'manager', 'pos'].includes(ctx.role) && !ctx.profile.isSuperAdmin)) notFound();
  const sp = await searchParams;
  const data = await getPos(ctx, sp.outlet, locale);
  return <PosTerminal data={data} locale={locale} currency={ctx.org.currency} manager={['owner', 'manager'].includes(ctx.role) || ctx.profile.isSuperAdmin} />;
}
