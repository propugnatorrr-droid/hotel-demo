import type { ModuleKey } from '@/lib/auth/types';

export type PlanKey = 'basic' | 'pro' | 'premium' | 'enterprise';

export const ALL_MODULES: ModuleKey[] = ['pms', 'calendar', 'channel_manager', 'booking_engine', 'ai_chat', 'inbox', 'pos', 'spa', 'invoicing', 'fiscalization', 'expenses', 'owner_ai', 'voice_agent', 'reports'];

/** PLAN §10.2: default module set per plan. Real-time OTA sync and voice are paid add-ons on lower plans. */
export const PLAN_MODULES: Record<PlanKey, ModuleKey[]> = {
  basic: ['pms', 'calendar', 'booking_engine', 'invoicing', 'reports'],
  pro: ['pms', 'calendar', 'booking_engine', 'invoicing', 'reports', 'inbox', 'ai_chat', 'pos', 'spa', 'expenses', 'fiscalization'],
  premium: ['pms', 'calendar', 'booking_engine', 'invoicing', 'reports', 'inbox', 'ai_chat', 'pos', 'spa', 'expenses', 'fiscalization', 'owner_ai', 'channel_manager', 'voice_agent'],
  enterprise: ALL_MODULES,
};

/** Hotel size drives the price: bigger properties use more AI, messages and support. */
export type SizeKey = 'small' | 'medium' | 'large';
export const SIZE_TIERS: Record<SizeKey, { maxRooms: number }> = { small: { maxRooms: 15 }, medium: { maxRooms: 40 }, large: { maxRooms: 100 } };
export const sizeForRooms = (rooms: number): SizeKey | 'enterprise' => (rooms <= 15 ? 'small' : rooms <= 40 ? 'medium' : rooms <= 100 ? 'large' : 'enterprise');
export type PaidPlan = 'basic' | 'pro' | 'premium';
export const PLAN_NAMES: Record<PlanKey, string> = { basic: 'Essential', pro: 'Professional', premium: 'Signature', enterprise: 'Enterprise' };

/**
 * PRICING RULES that keep every hotel profitable (see PLAN §3.2):
 *  1. Base price by size and plan (EUR/month, monthly billing; annual prepay = 2 months free).
 *  2. Real-time OTA sync (Channex, $7 per hotel + $130 platform) is INCLUDED only in Signature, an add-on elsewhere.
 *     We only activate the Channex platform once at least CHANNEX_MIN_HOTELS hotels pay for real-time sync.
 *  3. One-time setup fee per size (data import, channel mapping, training) paid up front.
 *  4. Metered extras (WhatsApp, voice minutes, AI conversations) are included up to a quota, then billed cost-plus.
 *  5. Founding offer (first 50 hotels, 2 years) never goes below FOUNDING_MIN_MARGIN.
 */
export const PLAN_PRICE_EUR: Record<PaidPlan, Record<SizeKey, number>> = {
  basic: { small: 29, medium: 59, large: 119 },
  pro: { small: 79, medium: 149, large: 269 },
  premium: { small: 149, medium: 279, large: 499 },
};
export const SETUP_FEE_EUR: Record<SizeKey, number> = { small: 149, medium: 299, large: 499 };
export const FOUNDING_DISCOUNT = 0.3;
export const FOUNDING_HOTELS = 50;
export const FOUNDING_MIN_MARGIN = 0.5;
export const ANNUAL_MONTHS_FREE = 2;
export const CHANNEX_MIN_HOTELS = 2;

export const ADDONS = {
  /** Real-time sync on Basic/Pro (Signature includes it). Cost to us about EUR 6.5. */
  realtimeSync: { small: 29, medium: 39, large: 49 } as Record<SizeKey, number>,
  voice: { monthly: 49, includedMinutes: 150, extraPerMinute: 0.35 },
  voiceIncludedInSignature: 100,
  /** Template messages are the biggest variable cost, so quotas scale with size. Email is the free default. */
  whatsapp: { includedMessages: { small: 200, medium: 600, large: 1500 } as Record<SizeKey, number>, overagePerMessage: 0.04 },
  /** Guest AI conversations per month included in Professional; Signature gets 3x. Overage is nearly pure margin. */
  aiConversations: { included: { small: 300, medium: 800, large: 2000 } as Record<SizeKey, number>, signatureMultiplier: 3, overagePerConversation: 0.05 },
};
export const ENTERPRISE = { oneTimeMin: 5000, oneTimeMax: 20000, monthlyFrom: 249 };

/** Unit costs (EUR). DeepSeek V4 Flash via OpenRouter at the worst listed price ~ EUR 0.004 per guest conversation. */
export const UNIT_COST = { whatsappMessage: 0.028, voiceMinute: 0.15, aiRequest: 0.004, channexPerHotel: 6.5, infra: { small: 2, medium: 3, large: 5 } as Record<SizeKey, number> };
export const REALTIME_SYNC_COST_EUR = UNIT_COST.channexPerHotel;
export const FIXED_COSTS_EUR_MONTH = 45; // Vercel Pro + Supabase Pro. Channex platform fee ($130) is added once real-time hotels >= CHANNEX_MIN_HOTELS.
export const CHANNEX_PLATFORM_FEE_EUR = 120;

/** Worst-case monthly cost to serve one hotel with every included quota fully used. */
export function costEstimate(plan: PaidPlan, size: SizeKey) {
  const infra = UNIT_COST.infra[size];
  if (plan === 'basic') return infra;
  const conv = ADDONS.aiConversations.included[size] * (plan === 'premium' ? ADDONS.aiConversations.signatureMultiplier : 1);
  const ai = conv * 1.5 * UNIT_COST.aiRequest + (plan === 'premium' ? 3 : 0.5); // ~1.5 requests per conversation + owner AI / reports
  const whatsapp = ADDONS.whatsapp.includedMessages[size] * UNIT_COST.whatsappMessage;
  const signature = plan === 'premium' ? UNIT_COST.channexPerHotel + ADDONS.voiceIncludedInSignature * UNIT_COST.voiceMinute : 0;
  return Math.round((infra + ai + whatsapp + signature) * 10) / 10;
}

export const planPrice = (plan: PlanKey, size: SizeKey) => (plan === 'enterprise' ? null : PLAN_PRICE_EUR[plan][size]);
export const foundingPrice = (list: number) => Math.round(list * (1 - FOUNDING_DISCOUNT));
export function grossMargin(plan: PaidPlan, size: SizeKey, founding = true) {
  const price = founding ? foundingPrice(PLAN_PRICE_EUR[plan][size]) : PLAN_PRICE_EUR[plan][size];
  const cost = costEstimate(plan, size);
  return { price, cost, margin: Math.round((price - cost) * 10) / 10, pct: Math.round(((price - cost) / price) * 100) };
}

/** Actual usage vs plan: estimated cost, overage to bill, and margin. Used by the super-admin margin monitor. */
export function usageEconomics(input: { plan: PlanKey; size: SizeKey | 'enterprise'; founding: boolean; aiRequests: number; whatsappMessages: number; voiceMinutes: number; realtimeSync: boolean }) {
  if (input.plan === 'enterprise' || input.size === 'enterprise') return null;
  const { plan, size } = input;
  const list = PLAN_PRICE_EUR[plan][size];
  const price = input.founding ? foundingPrice(list) : list;
  const convIncluded = ADDONS.aiConversations.included[size] * (plan === 'premium' ? ADDONS.aiConversations.signatureMultiplier : 1);
  const conversations = input.aiRequests / 1.5;
  const waIncluded = plan === 'basic' ? 0 : ADDONS.whatsapp.includedMessages[size];
  const voiceIncluded = plan === 'premium' ? ADDONS.voiceIncludedInSignature : 0;
  const overage =
    Math.max(0, conversations - (plan === 'basic' ? 0 : convIncluded)) * ADDONS.aiConversations.overagePerConversation +
    Math.max(0, input.whatsappMessages - waIncluded) * ADDONS.whatsapp.overagePerMessage +
    Math.max(0, input.voiceMinutes - voiceIncluded) * ADDONS.voice.extraPerMinute;
  const cost = UNIT_COST.infra[size] + input.aiRequests * UNIT_COST.aiRequest + input.whatsappMessages * UNIT_COST.whatsappMessage + input.voiceMinutes * UNIT_COST.voiceMinute + (input.realtimeSync ? UNIT_COST.channexPerHotel : 0);
  const revenue = price + overage + (input.realtimeSync && plan !== 'premium' ? ADDONS.realtimeSync[size] : 0);
  return { price, overage: Math.round(overage * 100) / 100, cost: Math.round(cost * 100) / 100, revenue: Math.round(revenue * 100) / 100, margin: Math.round((revenue - cost) * 100) / 100, pct: Math.round(((revenue - cost) / revenue) * 100) };
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
