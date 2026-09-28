import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(amount: number, currency: 'ALL' | 'EUR' | 'USD' = 'EUR', locale: string = 'sq') {
  return new Intl.NumberFormat(locale === 'sq' ? 'sq-AL' : 'en-GB', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'ALL' ? 0 : 2,
  }).format(amount);
}

export function localized(value: { sq: string; en: string } | null | undefined, locale: string) {
  if (!value) return '';
  return locale === 'en' ? value.en || value.sq : value.sq || value.en;
}
