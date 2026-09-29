import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { AgentChat } from '@/components/app/agent/agent-chat';
import { requireOrg } from '@/lib/auth/session';
import { toolsFor } from '@/server/services/agent/tools';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string }> };

export default async function AssistantPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireOrg();
  if (!ctx.modules.has('pms') || toolsFor(ctx).length === 0) notFound();
  const { q } = await searchParams;
  return <AgentChat locale={locale} initialQuestion={q?.slice(0, 600)} />;
}
