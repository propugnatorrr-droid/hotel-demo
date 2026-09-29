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

export const PLAN_PRICE_USD: Record<PlanKey, number | null> = { basic: 20, pro: 50, premium: 100, enterprise: null };

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
