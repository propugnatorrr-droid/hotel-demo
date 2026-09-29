import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { AdminView } from '@/components/admin/admin-view';
import { requireUser } from '@/lib/auth/session';
import { getAdminOverview } from '@/server/queries/admin';

type Props = { params: Promise<{ locale: string }> };

export const dynamic = 'force-dynamic';

/** Founders' console: every hotel, plan, modules and cash payments. Super admins only. */
export default async function AdminPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { profile } = await requireUser();
  if (!profile.isSuperAdmin) notFound();
  return (
    <main className="min-h-dvh bg-background">
      <AdminView hotels={await getAdminOverview()} locale={locale} />
    </main>
  );
}
