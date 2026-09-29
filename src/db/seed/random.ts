export function createRng(seed: number) {
  let a = seed >>> 0;

  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min;

  const pick = <T>(items: readonly T[]): T => {
    if (items.length === 0) throw new Error('pick() on empty array');
    return items[Math.floor(next() * items.length)]!;
  };

  const chance = (p: number) => next() < p;

  const weighted = <K extends string>(weights: Readonly<Partial<Record<K, number>>>): K => {
    const entries = Object.entries(weights) as [K, number][];
    const total = entries.reduce((sum, [, w]) => sum + w, 0);
    let r = next() * total;
    for (const [key, w] of entries) {
      r -= w;
      if (r <= 0) return key;
    }
    return entries[entries.length - 1]![0];
  };

  const pickWeighted = <T>(items: readonly T[], weight: (item: T) => number): T => {
    const total = items.reduce((sum, item) => sum + weight(item), 0);
    let r = next() * total;
    for (const item of items) {
      r -= weight(item);
      if (r <= 0) return item;
    }
    return items[items.length - 1]!;
  };

  const shuffle = <T>(items: readonly T[]): T[] => {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  };

  const digits = (n: number) => Array.from({ length: n }, () => int(0, 9)).join('');
  const hex = (n: number) => Array.from({ length: n }, () => int(0, 15).toString(16)).join('');
  const alnum = (n: number) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: n }, () => chars[int(0, chars.length - 1)]).join('');
  };

  return { next, int, pick, chance, weighted, pickWeighted, shuffle, digits, hex, alnum };
}

export type Rng = ReturnType<typeof createRng>;
