'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { haptic, hapticsEnabled, hapticsSupported, setHapticsEnabled } from '@/lib/haptics';
import { cn } from '@/lib/utils';

/** Only shown on devices that can actually vibrate. */
export function HapticsToggle() {
  const t = useTranslations('shell');
  const [supported, setSupported] = useState(false);
  const [on, setOn] = useState(true);

  useEffect(() => {
    setSupported(hapticsSupported() && window.matchMedia('(pointer: coarse)').matches);
    setOn(hapticsEnabled());
  }, []);

  if (!supported) return null;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      data-haptic="off"
      onClick={() => {
        const next = !on;
        setOn(next);
        setHapticsEnabled(next);
        if (next) haptic('success');
      }}
      className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-surface"
    >
      <span className="min-w-0 flex-1 text-sm">{t('haptics')}</span>
      <span className={cn('relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200', on ? 'bg-success' : 'bg-surface-3')}>
        <span className={cn('absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow-soft transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]', on && 'translate-x-4')} />
      </span>
    </button>
  );
}
