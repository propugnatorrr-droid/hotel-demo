import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { PropertyPage } from '@/components/marketing/property-page';
import { isPropertyType, PROPERTY, PROPERTY_PHOTOS, PROPERTY_TYPES } from '@/components/marketing/property-copy';
import { routing } from '@/i18n/routing';
import { localePath } from '@/lib/paths';

type Props = { params: Promise<{ locale: string; type: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => PROPERTY_TYPES.map((type) => ({ locale, type })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, type } = await params;
  if (!hasLocale(routing.locales, locale) || !isPropertyType(type)) return {};
  const c = PROPERTY[locale === 'en' ? 'en' : 'sq'][type];
  return {
    title: c.seoTitle,
    description: c.seoDescription,
    alternates: {
      canonical: localePath(locale, `/for/${type}`),
      languages: { sq: localePath('sq', `/for/${type}`), en: localePath('en', `/for/${type}`) },
    },
    openGraph: { title: c.seoTitle, description: c.seoDescription, images: [PROPERTY_PHOTOS[type].hero] },
  };
}

export default async function ForPage({ params }: Props) {
  const { locale, type } = await params;
  if (!hasLocale(routing.locales, locale) || !isPropertyType(type)) notFound();
  setRequestLocale(locale);
  return <PropertyPage locale={locale} type={type} whatsapp={process.env.NEXT_PUBLIC_WHATSAPP ?? null} />;
}
