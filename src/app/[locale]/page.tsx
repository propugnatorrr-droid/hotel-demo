import { ArrowUpRight } from 'lucide-react';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { BRAND, DEMO_RESORT } from '@/config/brand';
import { ThemeToggle } from '@/components/theme/theme-toggle';

type Props = { params: Promise<{ locale: string }> };

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');

  return (
    <main className="bg-grain relative flex min-h-dvh flex-col overflow-hidden">
      <div className="bg-qilim pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />

      <header className="relative z-10 flex items-center justify-between px-6 py-6 md:px-10">
        <span className="font-display text-2xl">{BRAND.name}</span>
        <div className="flex items-center gap-3">
          <Link
            href="/"
            locale={locale === 'sq' ? 'en' : 'sq'}
            className="text-sm text-muted transition-colors hover:text-foreground"
          >
            {locale === 'sq' ? 'EN' : 'SQ'}
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 pb-24 md:px-10">
        <p className="animate-fade-up mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs tracking-wide text-muted uppercase backdrop-blur">
          <span className="size-1.5 rounded-full bg-accent" />
          {t('eyebrow')}
        </p>

        <h1 className="font-display animate-fade-up text-6xl [animation-delay:80ms] sm:text-7xl md:text-8xl lg:text-9xl">
          {t('title')}
        </h1>

        <p className="animate-fade-up mt-8 max-w-xl text-lg leading-relaxed text-muted [animation-delay:160ms]">
          {t('subtitle')}
        </p>

        <div className="animate-fade-up mt-12 flex flex-wrap items-center gap-3 [animation-delay:240ms]">
          <Link
            href="/app"
            className="group inline-flex h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground shadow-lift transition-transform duration-(--duration-base) ease-(--ease-out-expo) hover:-translate-y-0.5"
          >
            {t('ctaDemo')}
            <ArrowUpRight className="size-4 transition-transform duration-(--duration-base) group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </Link>
          <Link
            href={`/r/${DEMO_RESORT.slug}`}
            className="inline-flex h-12 items-center rounded-full border border-border-strong bg-surface/60 px-6 text-sm font-medium backdrop-blur transition-colors hover:bg-surface"
          >
            {t('ctaResort')}
          </Link>
        </div>
      </section>

      <footer className="relative z-10 flex items-center justify-between px-6 py-6 text-xs text-subtle md:px-10">
        <span>{t('status')}</span>
        <span className="tabular font-mono">
          {DEMO_RESORT.name} · {DEMO_RESORT.city}
        </span>
      </footer>
    </main>
  );
}
