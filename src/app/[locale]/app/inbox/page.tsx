import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { InboxView } from '@/components/app/inbox/inbox-view';
import { requireOrg } from '@/lib/auth/session';
import { getInboxCounts, getThread, INBOX_FILTERS, listConversations, type InboxFilter } from '@/server/queries/inbox';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ filter?: string; c?: string }> };

export default async function InboxPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireOrg();
  if (!ctx.modules.has('inbox') || (!['owner', 'manager', 'receptionist'].includes(ctx.role) && !ctx.profile.isSuperAdmin)) notFound();

  const sp = await searchParams;
  const filter: InboxFilter = (INBOX_FILTERS as readonly string[]).includes(sp.filter ?? '') ? (sp.filter as InboxFilter) : 'all';
  const [rows, counts, thread] = await Promise.all([listConversations(ctx, filter), getInboxCounts(ctx), getThread(ctx, sp.c, locale)]);
  return <InboxView rows={rows} counts={counts} filter={filter} thread={thread} orgId={ctx.org.id} locale={locale} />;
}
