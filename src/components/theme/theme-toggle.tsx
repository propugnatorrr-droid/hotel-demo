'use client';

import { Moon, Sun, SunMoon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { useTheme, type ThemePref } from './theme-provider';

const ORDER: ThemePref[] = ['auto', 'day', 'night'];
const ICONS = { auto: SunMoon, day: Sun, night: Moon } as const;

export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations('theme');
  const { pref, setPref } = useTheme();
  const Icon = ICONS[pref];
  const next = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length]!;

  return (
    <button
      type="button"
      onClick={() => setPref(next)}
      aria-label={t('toggle')}
      title={t(pref)}
      className={cn(
        'inline-flex h-9 items-center gap-2 rounded-full border border-border bg-surface/70 px-3 text-sm text-muted backdrop-blur',
        'transition-colors duration-(--duration-base) ease-(--ease-out-expo) hover:bg-surface hover:text-foreground',
        className,
      )}
    >
      <Icon className="size-4" strokeWidth={1.6} />
      <span>{t(pref)}</span>
    </button>
  );
}
