import { pgEnum } from 'drizzle-orm/pg-core';

export const memberRole = pgEnum('member_role', [
  'owner',
  'manager',
  'receptionist',
  'housekeeping',
  'pos',
  'spa',
  'accountant',
]);

export const planTier = pgEnum('plan_tier', ['basic', 'pro', 'premium', 'enterprise']);

export const orgStatus = pgEnum('org_status', ['demo', 'trial', 'active', 'suspended']);

export const currency = pgEnum('currency', ['ALL', 'EUR', 'USD']);

export const moduleKey = pgEnum('module_key', [
  'pms',
  'calendar',
  'channel_manager',
  'booking_engine',
  'ai_chat',
  'inbox',
  'pos',
  'spa',
  'invoicing',
  'fiscalization',
  'expenses',
  'owner_ai',
  'voice_agent',
  'reports',
]);

export const integrationMode = pgEnum('integration_mode', ['mock', 'sandbox', 'live']);

export const integrationProvider = pgEnum('integration_provider', [
  'channex',
  'ical',
  'meta_whatsapp',
  'meta_instagram',
  'meta_messenger',
  'paysera',
  'easypos',
  'fature_al',
  'vapi',
  'retell',
  'elevenlabs',
  'resend',
  'ai',
  'telegram',
]);

export const roomStatus = pgEnum('room_status', ['clean', 'dirty', 'inspected', 'out_of_order']);

export const bookingStatus = pgEnum('booking_status', [
  'tentative',
  'confirmed',
  'checked_in',
  'checked_out',
  'cancelled',
  'no_show',
]);

export const bookingSource = pgEnum('booking_source', [
  'direct',
  'website',
  'booking_com',
  'airbnb',
  'expedia',
  'agoda',
  'whatsapp',
  'instagram',
  'messenger',
  'phone',
  'ai_voice',
  'walk_in',
]);

export const folioStatus = pgEnum('folio_status', ['open', 'closed']);

export const folioItemType = pgEnum('folio_item_type', [
  'room',
  'restaurant',
  'bar',
  'pool_bar',
  'room_service',
  'spa',
  'minibar',
  'service',
  'tax',
  'discount',
]);

export const outletType = pgEnum('outlet_type', ['restaurant', 'bar', 'pool_bar', 'room_service', 'spa']);

export const posOrderStatus = pgEnum('pos_order_status', ['open', 'sent', 'served', 'paid', 'void']);

export const appointmentStatus = pgEnum('appointment_status', [
  'booked',
  'confirmed',
  'completed',
  'cancelled',
  'no_show',
]);

export const paymentMethod = pgEnum('payment_method', ['cash', 'card', 'bank_transfer', 'online', 'room_charge']);

export const invoiceStatus = pgEnum('invoice_status', ['draft', 'issued', 'fiscalized', 'cancelled', 'failed']);

export const messageChannel = pgEnum('message_channel', [
  'whatsapp',
  'instagram',
  'messenger',
  'web_chat',
  'email',
  'sms',
  'voice',
  'booking_com',
  'airbnb',
]);

export const conversationStatus = pgEnum('conversation_status', [
  'ai_handling',
  'needs_human',
  'human_handling',
  'resolved',
]);

export const messageDirection = pgEnum('message_direction', ['inbound', 'outbound']);

export const messageAuthor = pgEnum('message_author', ['guest', 'ai', 'staff', 'system']);

export const taskStatus = pgEnum('task_status', ['open', 'in_progress', 'done', 'cancelled']);

export const priority = pgEnum('priority', ['low', 'normal', 'high', 'urgent']);

export const housekeepingType = pgEnum('housekeeping_type', [
  'checkout_clean',
  'stayover',
  'inspection',
  'deep_clean',
  'turndown',
]);

export const alertSeverity = pgEnum('alert_severity', ['info', 'warning', 'critical']);

export const department = pgEnum('department', [
  'rooms',
  'restaurant',
  'bar',
  'spa',
  'maintenance',
  'marketing',
  'admin',
  'staff',
  'other',
]);
