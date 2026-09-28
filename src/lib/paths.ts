import { routing } from '@/i18n/routing';

export function localePath(locale: string, path: string) {
  if (locale === routing.defaultLocale) return path;
  return `/${locale}${path === '/' ? '' : path}`;
}

/** Only allow same-site relative redirects */
export function safeNext(next: unknown, fallback: string) {
  if (typeof next !== 'string' || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return fallback;
  }
  return next;
}
