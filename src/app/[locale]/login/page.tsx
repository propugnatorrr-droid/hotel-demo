import { Sparkles } from 'lucide-react';
import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Photo } from '@/components/marketing/live';
import { LocaleSwitch } from '@/components/app/locale-switch';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { BRAND } from '@/config/brand';
import { Link } from '@/i18n/navigation';
import { isDemoLoginEnabled } from '@/lib/auth/demo';
import { getSessionUser } from '@/lib/auth/session';
import { localePath } from '@/lib/paths';
import { LoginForm } from './login-form';

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string; error?: string; setup?: string }>;
};

export default async function LoginPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;

  if (!sp.error && !sp.setup && (await getSessionUser())) redirect(localePath(locale, '/app'));

  const t = await getTranslations('auth');
  const initialError = sp.setup ? 'notConfigured' : sp.error === 'noMembership' ? 'noMembership' : undefined;

  return (
    <main className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_1.15fr]">
      {/* photo: a hero on phones, a full side panel on desktop */}
      <aside className="relative order-1 h-[40dvh] min-h-64 overflow-hidden bg-ionian-950 text-limestone-100 lg:order-2 lg:h-auto lg:min-h-dvh">
        <Photo src="/images/platform/login.jpg" alt="" priority sizes="(min-width:1024px) 55vw, 100vw" className="animate-kenburns absolute inset-0" />
        <div className="absolute inset-0 bg-gradient-to-t from-ionian-950 via-ionian-950/35 to-ionian-950/55 lg:bg-gradient-to-tr lg:from-ionian-950/90 lg:via-ionian-950/20 lg:to-transparent" />
        <div className="bg-grain absolute inset-0 opacity-60" />

        <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-6 pt-[calc(1.25rem+env(safe-area-inset-top))] lg:hidden">
          <Link href="/" className="font-display text-2xl text-limestone-50">{BRAND.name}</Link>
          <LocaleSwitch />
        </header>

        <div className="relative flex h-full flex-col justify-end gap-8 p-6 pb-14 lg:justify-between lg:p-12 lg:pb-12 xl:p-16">
          <span className="hidden text-xs tracking-[0.2em] text-limestone-200 uppercase lg:block">{t('panelCaption')}</span>
          <div>
            <div className="animate-fade-up mb-10 hidden max-w-sm rounded-xl border border-white/15 bg-ionian-950/55 p-5 shadow-float backdrop-blur-md [animation-delay:250ms] lg:block">
              <p className="flex items-center gap-2 text-xs tracking-wide text-gold-400 uppercase">
                <Sparkles className="size-3.5" />
                {t('panelCardLabel')}
              </p>
              <p className="font-display mt-3 text-2xl leading-snug">{t('panelCardBody')}</p>
            </div>
            <p className="font-display animate-fade-up max-w-xl text-[2.25rem] leading-[1.06] text-limestone-50 [animation-delay:120ms] sm:text-[3rem] lg:text-[3.75rem] xl:text-[4.5rem]">
              {t('panelQuote')}
            </p>
          </div>
        </div>
      </aside>

      {/* form: a bottom sheet on phones */}
      <section className="relative z-10 order-2 -mt-9 flex flex-col rounded-t-[32px] bg-background px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] shadow-[0_-24px_60px_-30px_rgb(0_0_0/0.5)] lg:order-1 lg:mt-0 lg:rounded-none lg:px-12 lg:py-6 lg:shadow-none">
        <span aria-hidden className="mx-auto mt-3 h-1 w-10 rounded-full bg-border-strong lg:hidden" />
        <header className="hidden items-center justify-between lg:flex">
          <Link href="/" className="font-display text-2xl">
            {BRAND.name}
          </Link>
          <div className="flex items-center gap-2">
            <LocaleSwitch />
            <ThemeToggle />
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-8 lg:py-12">
          <h1 className="font-display animate-fade-up text-5xl md:text-6xl">{t('title')}</h1>
          <p className="animate-fade-up mt-3 text-muted [animation-delay:60ms]">{t('subtitle')}</p>
          <LoginForm
            next={typeof sp.next === 'string' ? sp.next : undefined}
            initialError={initialError}
            demoEnabled={isDemoLoginEnabled()}
          />
        </div>
      </section>
    </main>
  );
}
