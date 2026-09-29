import type { ModuleKey } from '@/lib/auth/types';

export type PlanKey = 'basic' | 'pro' | 'premium' | 'enterprise';

export const ALL_MODULES: ModuleKey[] = ['pms', 'calendar', 'channel_manager', 'booking_engine', 'ai_chat', 'inbox', 'pos', 'spa', 'invoicing', 'fiscalization', 'expenses', 'owner_ai', 'voice_agent', 'reports'];

/** PLAN §10.2: default module set per plan. Real-time OTA sync and voice are paid add-ons on lower plans. */
export const PLAN_MODULES: Record<PlanKey, ModuleKey[]> = {
  basic: ['pms', 'calendar', 'booking_engine', 'invoicing', 'reports'],
  pro: ['pms', 'calendar', 'booking_engine', 'invoicing', 'reports', 'inbox', 'ai_chat', 'pos', 'spa', 'expenses', 'fiscalization'],
  premium: ['pms', 'calendar', 'booking_engine', 'invoicing', 'reports', 'inbox', 'ai_chat', 'pos', 'spa', 'expenses', 'fiscalization', 'owner_ai', 'channel_manager'],
  enterprise: ALL_MODULES,
};

/** Hotel size drives the price: bigger properties use more AI, messages and support. */
export type SizeKey = 'small' | 'medium' | 'large';
export const SIZE_TIERS: Record<SizeKey, { maxRooms: number }> = { small: { maxRooms: 15 }, medium: { maxRooms: 40 }, large: { maxRooms: 100 } };
export const sizeForRooms = (rooms: number): SizeKey | 'enterprise' => (rooms <= 15 ? 'small' : rooms <= 40 ? 'medium' : rooms <= 100 ? 'large' : 'enterprise');

/** List price, EUR per month, billed monthly. Annual billing = 2 months free. Founding offer: 30% off for the first 50 hotels, locked 2 years. */
export const PLAN_PRICE_EUR: Record<Exclude<PlanKey, 'enterprise'>, Record<SizeKey, number>> = {
  basic: { small: 19, medium: 39, large: 79 },
  pro: { small: 49, medium: 99, large: 179 },
  premium: { small: 89, medium: 169, large: 299 },
};
export const FOUNDING_DISCOUNT = 0.3;
export const FOUNDING_HOTELS = 50;

/** Paid add-ons. Real-time OTA sync is priced above its Channex cost ($7/hotel/month). */
export const ADDONS = {
  realtimeSync: { small: 12, medium: 15, large: 19 } as Record<SizeKey, number>,
  voice: { monthly: 39, includedMinutes: 150, extraPerMinute: 0.3 },
  /** Template messages (pre-arrival, welcome, review) are the biggest variable cost, so the included quota scales with size. */
  whatsapp: { includedMessages: { small: 200, medium: 600, large: 1500 } as Record<SizeKey, number>, passThroughMarkup: 0.25 },
};
export const ENTERPRISE = { oneTimeMin: 5000, oneTimeMax: 20000, monthlyFrom: 249 };

/**
 * Worst-case monthly cost to serve one hotel, EUR. Assumptions (review quarterly with real bills):
 *  - AI on DeepSeek V4 Flash via OpenRouter at the worst listed price ($0.10 in / $1.25 out per 1M tokens);
 *    guest chat + owner AI + drafts + OCR: ~EUR 2.5 / 5 / 10 per month by size on Pro (x1.3 on Premium: owner AI + reports).
 *  - WhatsApp template messages ~EUR 0.028 each, whole included quota consumed (email is the free default).
 *  - Infra share (Vercel + Supabase) EUR 2 / 3 / 5.
 */
export function costEstimate(plan: Exclude<PlanKey, 'enterprise'>, size: SizeKey) {
  const infra = { small: 2, medium: 3, large: 5 }[size];
  if (plan === 'basic') return infra;
  const ai = { small: 2.5, medium: 5, large: 10 }[size] * (plan === 'premium' ? 1.3 : 1);
  const whatsapp = ADDONS.whatsapp.includedMessages[size] * 0.028;
  return Math.round((infra + ai + whatsapp) * 10) / 10;
}
export const REALTIME_SYNC_COST_EUR = 6.5;
export const VOICE_COST_PER_MIN_EUR = 0.15; // Vapi + Azure speech + LLM
export const FIXED_COSTS_EUR_MONTH = 160; // Vercel Pro + Supabase Pro + Channex platform fee

export const planPrice = (plan: PlanKey, size: SizeKey) => (plan === 'enterprise' ? null : PLAN_PRICE_EUR[plan][size]);
export const foundingPrice = (list: number) => Math.round(list * (1 - FOUNDING_DISCOUNT));
export function grossMargin(plan: Exclude<PlanKey, 'enterprise'>, size: SizeKey, founding = true) {
  const price = founding ? foundingPrice(PLAN_PRICE_EUR[plan][size]) : PLAN_PRICE_EUR[plan][size];
  const cost = costEstimate(plan, size);
  return { price, cost, margin: Math.round((price - cost) * 10) / 10, pct: Math.round(((price - cost) / price) * 100) };
}

export const MODULE_LABELS: Record<ModuleKey, { sq: string; en: string }> = {
  pms: { sq: 'Recepsioni (PMS)', en: 'Front desk (PMS)' },
  calendar: { sq: 'Kalendari', en: 'Calendar' },
  channel_manager: { sq: 'Menaxheri i kanaleve', en: 'Channel manager' },
  booking_engine: { sq: 'Faqja dhe rezervimet online', en: 'Website and online booking' },
  ai_chat: { sq: 'Asistenti AI i mysafirëve', en: 'Guest AI assistant' },
  inbox: { sq: 'Kutia e mesazheve', en: 'Unified inbox' },
  pos: { sq: 'POS (bar, restorant)', en: 'POS (bar, restaurant)' },
  spa: { sq: 'Spa', en: 'Spa' },
  invoicing: { sq: 'Faturimi', en: 'Invoicing' },
  fiscalization: { sq: 'Fiskalizimi', en: 'Fiscalization' },
  expenses: { sq: 'Shpenzimet dhe OCR', en: 'Expenses and OCR' },
  owner_ai: { sq: 'AI për pronarin', en: 'Owner AI' },
  voice_agent: { sq: 'Asistenti zanor', en: 'Voice assistant' },
  reports: { sq: 'Raportet', en: 'Reports' },
};

export const DEFAULT_TEMPLATES = [
  { key: 'pre_arrival', name: 'Para mbërritjes', trigger: 'before_arrival_1d', body: { sq: 'Përshëndetje {{name}}, ju presim më {{check_in}}! Na shkruani këtu nëse keni nevojë për ndihmë.', en: 'Hello {{name}}, we look forward to welcoming you on {{check_in}}! Message us here if you need anything.' } },
  { key: 'welcome', name: 'Mirëseardhje', trigger: 'after_checkin', body: { sq: 'Mirë se erdhët, {{name}}! Nëse keni nevojë për diçka, na shkruani këtu.', en: 'Welcome, {{name}}! If you need anything, message us here.' } },
  { key: 'review_request', name: 'Kërkesë për vlerësim', trigger: 'after_checkout', body: { sq: 'Faleminderit që qëndruat me ne, {{name}}! Një vlerësim do të na ndihmonte shumë: {{review_link}}', en: 'Thank you for staying with us, {{name}}! A review would mean a lot: {{review_link}}' } },
];
