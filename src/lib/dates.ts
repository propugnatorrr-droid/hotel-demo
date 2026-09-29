const toUtc = (d: string) => new Date(`${d}T00:00:00Z`);

export const intlLocale = (locale: string) => (locale === 'en' ? 'en-GB' : 'sq-AL');

/** YYYY-MM-DD in the hotel's timezone */
export function todayIn(tz: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function hourIn(tz: string, now: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hour12: false }).format(now)) % 24;
}

export function addDays(d: string, n: number): string {
  const x = toUtc(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

/** a − b in days */
export function diffDays(a: string, b: string): number {
  return Math.round((toUtc(a).getTime() - toUtc(b).getTime()) / 86_400_000);
}

/** Format a stay date (YYYY-MM-DD) without timezone drift */
export function formatDay(d: string, locale: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { ...options, timeZone: 'UTC' }).format(toUtc(d));
}

export function relativeTime(date: Date, locale: string, now: Date = new Date()): string {
  const sec = Math.round((date.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(sec);
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), { numeric: 'auto' });
  if (abs < 60) return rtf.format(0, 'second');
  if (abs < 3600) return rtf.format(Math.round(sec / 60), 'minute');
  if (abs < 86_400) return rtf.format(Math.round(sec / 3600), 'hour');
  return rtf.format(Math.round(sec / 86_400), 'day');
}

export function capitalize(s: string): string {
  return s.charAt(0).toLocaleUpperCase() + s.slice(1);
}

function tzOffsetMs(ts: number, tz: string) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(ts));
  const g = (t: string) => Number(p.find((x) => x.type === t)?.value);
  return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) - Math.floor(ts / 1000) * 1000;
}

/** Wall-clock date + "HH:mm" in a timezone → UTC Date. */
export function zonedToUtc(date: string, time: string, tz: string): Date {
  const [y, mo, d] = date.split('-').map(Number) as [number, number, number];
  const [h, m] = time.split(':').map(Number) as [number, number];
  const guess = Date.UTC(y, mo - 1, d, h, m);
  return new Date(guess - tzOffsetMs(guess, tz));
}

/** "HH:mm" of a Date in a timezone. */
export function timeIn(tz: string, d: Date): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
}
