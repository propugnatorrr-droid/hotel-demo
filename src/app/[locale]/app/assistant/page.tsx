import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { OwnerAssistant } from '@/components/app/owner-assistant';
import { StaffAssistant } from '@/components/app/operations/staff-assistant';
import { requireOrg } from '@/lib/auth/session';
import { todayIn } from '@/lib/dates';

type Props = { params: Promise<{ locale: string }> };

export default async function AssistantPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireOrg();

  if (!ctx.modules.has('pms') || !['owner', 'manager', 'receptionist', 'housekeeping', 'accountant'].includes(ctx.role)) notFound();

  const money = ['owner', 'manager', 'accountant'].includes(ctx.role) || ctx.profile.isSuperAdmin;
  if (money && ctx.modules.has('owner_ai')) return <OwnerAssistant locale={locale} currency={ctx.org.currency} />;
  if (ctx.role === 'accountant') notFound();
  return <StaffAssistant locale={locale} today={todayIn(ctx.org.timezone)} />;
}
