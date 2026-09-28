import { Sparkles } from 'lucide-react';
import { redirect } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
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

const panelPattern = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='56' viewBox='0 0 48 48'%3E%3Cg fill='none' stroke='%23F6F1E8' stroke-opacity='0.07'%3E%3Cpath d='M24 4 44 24 24 44 4 24Z'/%3E%3Cpath d='M24 14 34 24 24 34 14 24Z'/%3E%3Cpath d='M0 0 8 8M48 0 40 8M0 48 8 40M48 48 40 40'/%3E%3C/g%3E%3C/svg%3E\")",
} as const;

const panelGlow = {
  background:
    'radial-gradient(ellipse at 25% 15%, color-mix(in oklab, var(--color-ionian-500) 45%, transparent), transparent 60%), radial-gradient(ellipse at 85% 95%, color-mix(in oklab, var(--color-gold-400) 28%, transparent), transparent 55%)',
} as const;

export default async function LoginPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const sp = await searchParams;

  if (!sp.error && !sp.setup && (await getSessionUser())) redirect(localePath(locale, '/app'));

  const t = await getTranslations('auth');
  const initialError = sp.setup ? 'notConfigured' : sp.error === 'noMembership' ? 'noMembership' : undefined;

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <section className="relative flex flex-col px-6 py-6 md:px-12">
        <header className="flex items-center justify-between">
          <Link href="/" className="font-display text-2xl">
            {BRAND.name}
          </Link>
          <div className="flex items-center gap-2">
            <LocaleSwitch />
            <ThemeToggle />
          </div>
        </header>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="font-display animate-fade-up text-5xl md:text-6xl">{t('title')}</h1>
          <p className="animate-fade-up mt-3 text-muted [animation-delay:60ms]">{t('subtitle')}</p>
          <LoginForm
            next={typeof sp.next === 'string' ? sp.next : undefined}
            initialError={initialError}
            demoEnabled={isDemoLoginEnabled()}
          />
        </div>
      </section>

      <aside className="relative hidden overflow-hidden bg-ionian-950 text-limestone-100 lg:block">
        <div className="absolute inset-0" style={panelPattern} />
        <div className="absolute inset-0" style={panelGlow} />
        <div className="bg-grain absolute inset-0" />
        <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
          <span className="text-xs tracking-[0.2em] text-limestone-300 uppercase">{t('panelCaption')}</span>
          <div>
            <div className="animate-fade-up mb-12 max-w-sm rounded-xl border border-white/10 bg-white/5 p-5 shadow-float backdrop-blur-md [animation-delay:250ms]">
              <p className="flex items-center gap-2 text-xs tracking-wide text-gold-400 uppercase">
                <Sparkles className="size-3.5" />
                {t('panelCardLabel')}
              </p>
              <p className="font-display mt-3 text-2xl leading-snug">{t('panelCardBody')}</p>
            </div>
            <p className="font-display animate-fade-up max-w-xl text-6xl leading-[1.02] [animation-delay:120ms] xl:text-7xl">
              {t('panelQuote')}
            </p>
          </div>
        </div>
      </aside>
    </main>
  );
}
