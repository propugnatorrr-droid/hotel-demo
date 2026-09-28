import { ArrowLeft } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';

export async function ComingSoon({ sectionKey, batch }: { sectionKey: string; batch: number }) {
  const t = await getTranslations('comingSoon');
  const tNav = await getTranslations('nav.items');

  return (
    <div className="relative flex min-h-[65vh] flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-border-strong px-6 text-center">
      <div className="bg-qilim pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_10%,transparent_65%)]" />
      <div className="relative">
        <Badge tone="accent" dot className="animate-fade-up">
          {t('eyebrow')}
        </Badge>
        <h1 className="font-display animate-fade-up mt-6 text-5xl [animation-delay:60ms] md:text-6xl">
          {t('title', { section: tNav(sectionKey) })}
        </h1>
        <p className="animate-fade-up mx-auto mt-4 max-w-md text-muted [animation-delay:120ms]">
          {t('body', { batch })}
        </p>
        <Button asChild variant="secondary" className="animate-fade-up mt-8 [animation-delay:180ms]">
          <Link href="/app">
            <ArrowLeft />
            {t('back')}
          </Link>
        </Button>
      </div>
    </div>
  );
}
