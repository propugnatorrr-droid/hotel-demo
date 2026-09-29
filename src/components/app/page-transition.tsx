'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';

/**
 * iOS-style page push. On phones a new page slides in from the right with a spring; on
 * back/forward (browser gesture, which Safari animates itself) it only fades, so the two
 * never fight. Desktop gets a short lift. Only x/y/opacity are animated so position:fixed
 * children keep working once the page has settled. The very first render after a hard
 * load is never animated, which keeps server and client markup identical.
 */
let popped = false;
let ready = false;
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    popped = true;
  });
}

type Mode = 'none' | 'push' | 'pop' | 'lift';
const spring = { type: 'spring', stiffness: 380, damping: 38, mass: 0.9 } as const;

export function PageTransition({ children, variant = 'app' }: { children: React.ReactNode; variant?: 'app' | 'site' }) {
  const reduce = useReducedMotion();
  const [mode] = useState<Mode>(() => {
    if (typeof window === 'undefined' || !ready) return 'none';
    const back = popped;
    popped = false;
    if (back) return 'pop';
    return window.matchMedia('(max-width: 767px)').matches ? 'push' : 'lift';
  });
  useEffect(() => {
    ready = true;
  }, []);

  if (reduce || mode === 'none') return <>{children}</>;

  const initial =
    mode === 'push' ? { opacity: 0.4, x: 36 } : mode === 'pop' ? { opacity: 0 } : { opacity: 0, y: variant === 'site' ? 0 : 10 };
  const animate = mode === 'push' ? { opacity: 1, x: 0 } : mode === 'pop' ? { opacity: 1 } : { opacity: 1, y: 0 };
  const transition = mode === 'push' ? spring : { duration: mode === 'pop' ? 0.18 : 0.45, ease: [0.16, 1, 0.3, 1] as const };

  return (
    <motion.div initial={initial} animate={animate} transition={transition} className="[overflow-x:clip]">
      {children}
    </motion.div>
  );
}
