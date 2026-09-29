import { addDays } from '@/lib/dates';

const iso = /^\d{4}-\d{2}-\d{2}$/;

export function resolveRange(today: string, sp: { preset?: string; from?: string; to?: string }) {
  if (iso.test(sp.from ?? '') && iso.test(sp.to ?? '') && sp.from! <= sp.to!) return { preset: 'custom', from: sp.from!, to: sp.to! };
  const y = today.slice(0, 4);
  const m = today.slice(0, 7);
  switch (sp.preset) {
    case '7': return { preset: '7', from: addDays(today, -6), to: today };
    case 'month': return { preset: 'month', from: `${m}-01`, to: today };
    case 'lastMonth': {
      const first = `${m}-01`;
      const to = addDays(first, -1);
      return { preset: 'lastMonth', from: `${to.slice(0, 7)}-01`, to };
    }
    case 'ytd': return { preset: 'ytd', from: `${y}-01-01`, to: today };
    default: return { preset: '30', from: addDays(today, -29), to: today };
  }
}
