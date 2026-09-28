'use client';

import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Kbd } from '@/components/ui/kbd';
import { openCommandBar } from './command-bar';

export function CommandTrigger() {
  const t = useTranslations('shell');
  const [mod, setMod] = useState('Ctrl');

  useEffect(() => {
    if (/Mac|iPhone|iPad/.test(navigator.userAgent)) setMod('⌘');
  }, []);

  return (
    <button
      type="button"
      onClick={openCommandBar}
      className="group flex h-10 w-full max-w-md items-center gap-3 rounded-full border border-border bg-surface/70 px-4 text-sm text-subtle shadow-soft backdrop-blur transition-[border-color,box-shadow] duration-200 hover:border-border-strong hover:shadow-lift"
    >
      <Sparkles className="size-4 text-accent transition-transform duration-300 group-hover:rotate-12" strokeWidth={1.8} />
      <span className="flex-1 truncate text-left">{t('searchPlaceholder')}</span>
      <span className="hidden items-center gap-1 sm:flex">
        <Kbd>{mod}</Kbd>
        <Kbd>K</Kbd>
      </span>
    </button>
  );
}
