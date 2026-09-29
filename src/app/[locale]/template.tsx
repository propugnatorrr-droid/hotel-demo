'use client';

import { PageTransition } from '@/components/app/page-transition';
import { usePathname } from '@/i18n/navigation';

/** Public pages (site, login, property types, resort sites) get the push; the app shell has its own template. */
export default function LocaleTemplate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith('/app') || pathname.startsWith('/admin') || pathname.startsWith('/print')) return <>{children}</>;
  return <PageTransition variant="site">{children}</PageTransition>;
}
