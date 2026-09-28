'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { cn } from '@/lib/utils';
import { setSimpleMode } from '@/server/actions/preferences';

export function SimpleModeToggle({ enabled }: { enabled: boolean }) {
  const t = useTranslations('shell');
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={pending}
      onClick={() => {
        const next = !on;
        setOn(next);
        start(async () => {
          await setSimpleMode(next);
        });
      }}
      className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-surface disabled:opacity-60"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm">{t('simpleMode')}</span>
        <span className="block text-xs text-subtle">{t('simpleModeHint')}</span>
      </span>
      <span
        className={cn(
          'relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200',
          on ? 'bg-success' : 'bg-surface-3',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-soft transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
            on && 'translate-x-4',
          )}
        />
      </span>
    </button>
  );
}
