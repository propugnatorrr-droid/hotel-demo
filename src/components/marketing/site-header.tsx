'use client';

import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'motion/react';
import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, usePathname } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

const COPY = {
  sq: { features: 'Veçoritë', types: 'Llojet e hoteleve', how: 'Si punon', pricing: 'Çmimet', faq: 'Pyetje', demo: 'Provo demon', login: 'Hyr', menu: 'Menuja', close: 'Mbyll' },
  en: { features: 'Features', types: 'Property types', how: 'How it works', pricing: 'Pricing', faq: 'FAQ', demo: 'Try the demo', login: 'Sign in', menu: 'Menu', close: 'Close' },
} as const;

// On the home page a plain hash link lets Ambient scroll smoothly; elsewhere go home first.
function NavLink({ id, home, className, onClick, children }: { id: string; home: boolean; className?: string; onClick?: () => void; children: React.ReactNode }) {
  return home ? <a href={`#${id}`} className={className} onClick={onClick}>{children}</a> : <Link href={`/#${id}`} className={className} onClick={onClick}>{children}</Link>;
}

/** Fixed header shared by every public page: solid on scroll, full-screen menu on phones. */
export function SiteHeader({ locale }: { locale: string }) {
  const t = COPY[locale === 'en' ? 'en' : 'sq'];
  const pathname = usePathname();
  const other = locale === 'en' ? 'sq' : 'en';
  const { scrollY } = useScroll();
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);
  useMotionValueEvent(scrollY, 'change', (v) => { setSolid(v > 60); });

  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    document.documentElement.style.overflow = open ? 'hidden' : '';
    return () => { document.documentElement.style.overflow = ''; };
  }, [open]);

  const home = pathname === '/';
  const links = [
    { id: 'features', label: t.features },
    { id: 'types', label: t.types },
    { id: 'how', label: t.how },
    { id: 'pricing', label: t.pricing },
    { id: 'faq', label: t.faq },
  ];
  return (
    <>
      <header
        className={cn(
          'fixed inset-x-0 top-0 z-40 flex items-center justify-between px-5 pt-[calc(1rem+env(safe-area-inset-top))] pb-4 text-limestone-50 transition-[background-color,backdrop-filter,padding] duration-500 md:px-10',
          solid && 'bg-ionian-950/80 pt-[calc(0.75rem+env(safe-area-inset-top))] pb-3 backdrop-blur-xl',
        )}
      >
        <Link href="/" className="font-display text-2xl drop-shadow">Iliria</Link>
        <nav className="hidden items-center gap-7 text-sm lg:flex">
          {links.map((l) => <NavLink key={l.id} id={l.id} home={home} className="opacity-80 drop-shadow hover:opacity-100">{l.label}</NavLink>)}
          <Link href={pathname} locale={other} className="rounded-full border border-white/30 px-3 py-1 text-xs uppercase">{other}</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/app" className="rounded-full bg-gold-400 px-5 py-2 text-sm font-semibold text-ionian-950 shadow-lg transition-transform hover:-translate-y-0.5">{t.demo}</Link>
          <button type="button" aria-label={t.menu} onClick={() => setOpen(true)} className="grid size-10 place-items-center rounded-full border border-white/25 bg-white/5 backdrop-blur lg:hidden">
            <Menu className="size-5" />
          </button>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ clipPath: 'circle(0px at calc(100% - 2.5rem) 2.5rem)' }}
            animate={{ clipPath: 'circle(150% at calc(100% - 2.5rem) 2.5rem)' }}
            exit={{ clipPath: 'circle(0px at calc(100% - 2.5rem) 2.5rem)' }}
            transition={{ duration: 0.65, ease: [0.32, 0.72, 0, 1] }}
            className="bg-qilim fixed inset-0 z-50 flex flex-col bg-ionian-950 px-6 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))] text-limestone-50"
          >
            <div className="flex items-center justify-between">
              <span className="font-display text-2xl">Iliria</span>
              <button type="button" aria-label={t.close} onClick={() => setOpen(false)} className="grid size-10 place-items-center rounded-full border border-white/25 bg-white/5">
                <X className="size-5" />
              </button>
            </div>
            <nav className="mt-10 flex flex-1 flex-col justify-center gap-1">
              {links.map((l, i) => (
                <motion.div key={l.id} initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 + i * 0.06, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
                  <NavLink id={l.id} home={home} onClick={() => setOpen(false)} className="font-display block border-b border-white/10 py-3.5 text-4xl">{l.label}</NavLink>
                </motion.div>
              ))}
            </nav>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="flex items-center gap-3">
              <Link href="/app" className="grid h-12 flex-1 place-items-center rounded-full bg-gold-400 text-sm font-semibold text-ionian-950">{t.demo}</Link>
              <Link href="/login" className="grid h-12 place-items-center rounded-full border border-white/25 px-6 text-sm">{t.login}</Link>
              <Link href={pathname} locale={other} className="grid size-12 place-items-center rounded-full border border-white/25 text-xs uppercase">{other}</Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
