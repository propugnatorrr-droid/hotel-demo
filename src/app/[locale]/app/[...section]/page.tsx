import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { ComingSoon } from '@/components/app/coming-soon';
import { canAccess, NAV } from '@/config/navigation';
import { requireOrg } from '@/lib/auth/session';

type Props = { params: Promise<{ locale: string; section: string[] }> };

// Placeholder for every module until its batch replaces it with a real route
export default async function SectionPage({ params }: Props) {
  const { locale, section } = await params;
  setRequestLocale(locale);

  const ctx = await requireOrg();
  const item = NAV.find((i) => i.href === `/app/${section[0]}`);
  if (!item || !canAccess(item, ctx.role, ctx.modules)) notFound();

  return <ComingSoon sectionKey={item.key} batch={item.batch} />;
}
