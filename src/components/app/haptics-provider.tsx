'use client';

import { useEffect } from 'react';
import { haptic } from '@/lib/haptics';

const TAPPABLE =
  'button:not(:disabled), a[href], [role="button"], [role="tab"], [role="switch"], [role="menuitem"], [role="option"], [role="checkbox"], summary, label:has(input[type="checkbox"]), label:has(input[type="radio"])';

/** Site-wide: a soft tick on every touch tap of a control. Opt out with data-haptic="off". */
export function HapticsProvider() {
  useEffect(() => {
    let pointer: string = 'mouse';
    const down = (e: PointerEvent) => {
      pointer = e.pointerType;
    };
    const click = (e: MouseEvent) => {
      if (pointer === 'mouse' || !e.isTrusted) return;
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>(TAPPABLE);
      if (!el || el.closest('[data-haptic="off"]')) return;
      const kind = el.dataset.haptic as Parameters<typeof haptic>[0] | undefined;
      haptic(kind && kind !== ('off' as string) ? kind : 'selection');
    };
    document.addEventListener('pointerdown', down, { capture: true, passive: true });
    document.addEventListener('click', click, { capture: true, passive: true });
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('click', click, true);
    };
  }, []);
  return null;
}
