'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';
import { motion, useScroll, useSpring } from 'motion/react';

/** Site-wide feel: smooth scroll, film grain, scroll hairline, magnetic pill buttons. */
export function Ambient() {
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 200, damping: 30, mass: 0.3 });

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const lenis = new Lenis({ duration: 1.15, easing: (t: number) => 1 - Math.pow(1 - t, 4), smoothWheel: true });
    let raf = 0;
    const loop = (t: number) => { lenis.raf(t); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);

    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="#"]');
      const href = a?.getAttribute('href');
      if (!href || href.length < 2) return;
      let el: Element | null = null;
      try { el = document.querySelector(href); } catch { return; }
      if (!el) return;
      e.preventDefault();
      lenis.scrollTo(el as HTMLElement, { offset: -80 });
    };

    const SEL = 'a.rounded-full, button.rounded-full:not(:disabled)';
    let active: HTMLElement | null = null;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const el = (e.target as HTMLElement).closest<HTMLElement>(SEL);
      if (active && active !== el) { active.style.transform = ''; active = null; }
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = e.clientX - (r.left + r.width / 2);
      const y = e.clientY - (r.top + r.height / 2);
      el.style.transform = `translate3d(${x * 0.18}px, ${y * 0.28}px, 0)`;
      active = el;
    };

    document.addEventListener('click', onClick);
    document.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('click', onClick);
      document.removeEventListener('pointermove', onMove);
      if (active) active.style.transform = '';
      lenis.destroy();
    };
  }, []);

  return (
    <>
      <motion.div aria-hidden style={{ scaleX: progress }} className="fixed inset-x-0 top-0 z-[70] h-px origin-left bg-gold-400/80" />
      <div aria-hidden className="film-grain" />
    </>
  );
}
