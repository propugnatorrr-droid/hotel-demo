import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { StaffAssistant } from '@/components/app/operations/staff-assistant';
import { requireOrg } from '@/lib/auth/session';
import { todayIn } from '@/lib/dates';

type Props = { params: Promise<{ locale: string }> };

export default async function AssistantPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireOrg();

  if (
    !ctx.modules.has('pms') ||
    !['owner', 'manager', 'receptionist', 'housekeeping'].includes(ctx.role)
  ) notFound();

  return <StaffAssistant locale={locale} today={todayIn(ctx.org.timezone)} />;
}
