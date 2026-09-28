import { intlLocale } from './dates';

export type Currency = 'ALL' | 'EUR' | 'USD';

export function formatCurrency(amount: number, currency: Currency, locale: string, digits = 0): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
}

/** value is 0–100 */
export function formatPercent(value: number, locale: string): string {
  return new Intl.NumberFormat(intlLocale(locale), { style: 'percent', maximumFractionDigits: 0 }).format(value / 100);
}
