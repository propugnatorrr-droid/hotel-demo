import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['sq', 'en'],
  defaultLocale: 'sq',
  localePrefix: 'as-needed',
});

export type Locale = (typeof routing.locales)[number];
