import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { VoiceView } from '@/components/app/voice/voice-view';
import { requireOrg } from '@/lib/auth/session';
import { getVoice } from '@/server/queries/voice';

type Props = { params: Promise<{ locale: string }> };

export default async function VoicePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ctx = await requireOrg();
  if (!ctx.modules.has('voice_agent') || (!['owner', 'manager', 'receptionist'].includes(ctx.role) && !ctx.profile.isSuperAdmin)) notFound();
  return <VoiceView data={await getVoice(ctx, locale === 'en' ? 'en' : 'sq')} locale={locale} mounted={new Date().toISOString()} />;
}
