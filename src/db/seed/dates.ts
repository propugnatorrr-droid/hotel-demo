const TZ = 'Europe/Tirane';

const pad = (n: number) => String(n).padStart(2, '0');
const toDate = (d: string) => new Date(`${d}T00:00:00Z`);

export function todayInTirana(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function hourInTirana(date: Date): number {
  return (
    Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(date)) % 24
  );
}

export function addDays(d: string, n: number): string {
  const x = toDate(d);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

/** a − b in days */
export function diffDays(a: string, b: string): number {
  return Math.round((toDate(a).getTime() - toDate(b).getTime()) / 86_400_000);
}

export function dateRange(start: string, endExclusive: string): string[] {
  const out: string[] = [];
  for (let d = start; d < endExclusive; d = addDays(d, 1)) out.push(d);
  return out;
}

export const month = (d: string) => Number(d.slice(5, 7));

export function isWeekendNight(d: string): boolean {
  const w = toDate(d).getUTCDay();
  return w === 5 || w === 6;
}

export function seasonFactor(d: string): number {
  const m = month(d);
  if (m === 7 || m === 8) return 1.6;
  if (m === 6 || m === 9) return 1.25;
  if (m === 5 || m === 10) return 1;
  return 0.75;
}

function tiranaOffset(d: string) {
  const m = month(d);
  return m >= 4 && m <= 10 ? '+02:00' : '+01:00';
}

/** A moment at local Tirana time on day d */
export function at(d: string, hour: number, minute = 0): Date {
  return new Date(`${d}T${pad(hour)}:${pad(minute)}:00${tiranaOffset(d)}`);
}

export type Rng = ReturnType<typeof createRng>;
