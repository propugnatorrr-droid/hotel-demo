import { Sparkles } from 'lucide-react';
import { getTranslations } from 'next-intl/server';

export async function DemoBanner() {
  const t = await getTranslations('shell');
  return (
    <div className="flex h-8 items-center justify-center gap-2 border-b border-border bg-accent-soft text-xs text-accent">
      <Sparkles className="size-3.5" />
      {t('demoBanner')}
    </div>
  );
}
