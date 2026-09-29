import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { ResortSite } from '@/components/resort/resort-site';
import { ConciergeChat } from '@/components/resort/concierge-chat';
import { todayIn } from '@/lib/dates';
import { getPublicContent, getPublicOrg } from '@/server/services/public-site';

type Props = { params: Promise<{ locale: string; slug: string }> };

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, locale } = await params;
  const pub = await getPublicOrg(slug);
  if (!pub) return {};
  return {
    title: `${pub.org.name}${pub.org.city ? ` · ${pub.org.city}` : ''}`,
    description: locale === 'en' ? `Book direct at ${pub.org.name}. Best rate, no commission.` : `Rezervo direkt te ${pub.org.name}. Çmimi më i mirë, pa komision.`,
  };
}

export default async function ResortPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const pub = await getPublicOrg(slug);
  if (!pub) notFound();
  const { org, modules } = pub;
  const content = await getPublicContent(org.id, locale);

  return (
    <ResortSite
      slug={org.slug}
      name={org.name}
      city={org.city}
      address={org.address}
      phone={org.phone}
      email={org.email}
      coverImage={org.coverImageUrl}
      currency={org.currency}
      locale={locale}
      today={todayIn(org.timezone)}
      content={content}
      chat={modules.has('ai_chat') ? <ConciergeChat slug={org.slug} locale={locale} name={org.aiPersona?.name ?? org.name} /> : null}
    />
  );
}
