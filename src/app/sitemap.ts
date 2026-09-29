import type { MetadataRoute } from 'next';
import { PROPERTY_TYPES } from '@/components/marketing/property-copy';
import { routing } from '@/i18n/routing';
import { localePath } from '@/lib/paths';
import { siteUrl } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const paths = ['/', '/login', '/r/vala', ...PROPERTY_TYPES.map((t) => `/for/${t}`)];
  return paths.flatMap((p) =>
    routing.locales.map((locale) => ({
      url: `${base}${localePath(locale, p)}`,
      changeFrequency: 'weekly' as const,
      priority: p === '/' ? 1 : p.startsWith('/for/') ? 0.8 : 0.5,
      alternates: { languages: Object.fromEntries(routing.locales.map((l) => [l, `${base}${localePath(l, p)}`])) },
    })),
  );
}
