'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

export function LocaleSwitch({ className }: { className?: string }) {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations('common');
  const other = locale === 'sq' ? 'en' : 'sq';

  return (
    <Link
      href={pathname}
      locale={other}
      aria-label={t('language')}
      className={cn(
        'inline-flex h-9 items-center rounded-full border border-border px-3 font-mono text-xs tracking-wide text-muted uppercase transition-colors hover:bg-surface hover:text-foreground',
        className,
      )}
    >
      {other}
    </Link>
  );
}
