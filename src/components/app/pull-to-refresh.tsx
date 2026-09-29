'use client';

import { motion, useMotionValue, useTransform } from 'motion/react';
import { Loader2, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { haptic } from '@/lib/haptics';

const THRESHOLD = 78;

/** iOS-style pull to refresh for touch screens: re-fetches the current server page in place. */
export function PullToRefresh() {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const pull = useMotionValue(0);
  const y = useTransform(pull, (v) => Math.min(v, 120) - 44);
  const rotate = useTransform(pull, [0, THRESHOLD], [0, 270]);
  const opacity = useTransform(pull, [8, 40], [0, 1]);
  const [armed, setArmed] = useState(false);
  const state = useRef<{ y0: number; x0: number; active: boolean; armed: boolean }>({ y0: 0, x0: 0, active: false, armed: false });

  useEffect(() => {
    if (!window.matchMedia('(pointer: coarse)').matches) return;

    const scrollable = (node: HTMLElement | null) => {
      for (let n = node; n && n !== document.body; n = n.parentElement) {
        if (n.closest('[data-no-ptr]') === n) return true;
        const cs = getComputedStyle(n);
        if (/(auto|scroll)/.test(cs.overflowY) && n.scrollHeight > n.clientHeight && n.scrollTop > 0) return true;
        if (/(auto|scroll)/.test(cs.overflowX) && n.scrollWidth > n.clientWidth) return false;
      }
      return false;
    };

    const start = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t || e.touches.length > 1) return;
      const s = state.current;
      s.active = (document.scrollingElement?.scrollTop ?? 0) <= 0 && !document.querySelector('[data-state="open"][role="dialog"]') && !scrollable(e.target as HTMLElement);
      s.y0 = t.clientY;
      s.x0 = t.clientX;
      s.armed = false;
    };
    const move = (e: TouchEvent) => {
      const s = state.current;
      const t = e.touches[0];
      if (!s.active || !t) return;
      const dy = t.clientY - s.y0;
      const dx = Math.abs(t.clientX - s.x0);
      if (dy <= 0 || dx > dy) {
        if (dy <= 0) { s.active = false; pull.set(0); }
        return;
      }
      pull.set(dy * 0.5); // resistance
      const now = dy * 0.5 >= THRESHOLD;
      if (now !== s.armed) {
        s.armed = now;
        setArmed(now);
        if (now) haptic('medium');
      }
    };
    const end = () => {
      const s = state.current;
      if (!s.active) return;
      s.active = false;
      if (s.armed) {
        haptic('success');
        startTransition(() => router.refresh());
      }
      s.armed = false;
      setArmed(false);
      pull.set(0);
    };

    document.addEventListener('touchstart', start, { passive: true });
    document.addEventListener('touchmove', move, { passive: true });
    document.addEventListener('touchend', end, { passive: true });
    document.addEventListener('touchcancel', end, { passive: true });
    return () => {
      document.removeEventListener('touchstart', start);
      document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', end);
      document.removeEventListener('touchcancel', end);
    };
  }, [router, pull]);

  return (
    <motion.div
      aria-hidden
      data-haptic="off"
      style={{ y: busy ? 24 : y, opacity: busy ? 1 : opacity, top: 'env(safe-area-inset-top)' }}
      transition={{ type: 'spring', stiffness: 400, damping: 34 }}
      className="pointer-events-none fixed inset-x-0 z-50 flex justify-center lg:hidden"
    >
      <div className="grid size-10 place-items-center rounded-full border border-border bg-surface/90 shadow-lift backdrop-blur-xl">
        {busy ? <Loader2 className="size-4 animate-spin text-primary" /> : (
          <motion.span style={{ rotate }} className={armed ? 'text-accent' : 'text-subtle'}>
            <RefreshCw className="size-4" />
          </motion.span>
        )}
      </div>
    </motion.div>
  );
}
