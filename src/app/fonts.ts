import { Fraunces, Geist_Mono, Manrope } from 'next/font/google';

// UI: Manrope (open, calm, full Albanian ë/ç support). Display: Fraunces (soft, warm luxury serif, optical sizing).
export const fontSans = Manrope({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-manrope',
  display: 'swap',
});

export const fontMono = Geist_Mono({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-geist-mono',
  display: 'swap',
});

export const fontSerif = Fraunces({
  subsets: ['latin', 'latin-ext'],
  style: ['normal', 'italic'],
  axes: ['opsz', 'SOFT'],
  variable: '--font-fraunces',
  display: 'swap',
});
