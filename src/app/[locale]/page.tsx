import { setRequestLocale } from 'next-intl/server';
import { MarketingHome } from '@/components/marketing/home';
import { BRAND } from '@/config/brand';

type Props = { params: Promise<{ locale: string }> };

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <MarketingHome locale={locale} whatsapp={process.env.NEXT_PUBLIC_WHATSAPP ?? null} email={BRAND.supportEmail} />;
}
