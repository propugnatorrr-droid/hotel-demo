import 'server-only';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { integrations } from '@/db/schema';
import type { integrationMode, integrationProvider } from '@/db/schema/enums';

export type IntegrationMode = (typeof integrationMode.enumValues)[number];
export type IntegrationProvider = (typeof integrationProvider.enumValues)[number];

export type IntegrationState = {
  provider: IntegrationProvider;
  mode: IntegrationMode;
  enabled: boolean;
  config: Record<string, unknown>;
};

/**
 * Adapter rule (PLAN §8.4): the app never calls a provider directly.
 * It asks the registry which mode a hotel runs a provider in, and each adapter
 * picks mock / sandbox / live behaviour from that. Missing row = mock.
 */
export async function getIntegration(orgId: string, provider: IntegrationProvider): Promise<IntegrationState> {
  const [row] = await db
    .select()
    .from(integrations)
    .where(and(eq(integrations.orgId, orgId), eq(integrations.provider, provider)))
    .limit(1);
  return { provider, mode: row?.mode ?? 'mock', enabled: row?.isEnabled ?? true, config: row?.config ?? {} };
}

export async function markSync(orgId: string, provider: IntegrationProvider, error: string | null) {
  await db
    .update(integrations)
    .set({ lastSyncAt: new Date(), lastError: error })
    .where(and(eq(integrations.orgId, orgId), eq(integrations.provider, provider)));
}

/** Env presence checks so the UI can say "add the key" instead of failing later. */
export const providerEnv: Record<string, string[]> = {
  channex: ['CHANNEX_API_KEY'],
  meta_whatsapp: ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID'],
  meta_instagram: ['META_APP_SECRET'],
  meta_messenger: ['META_APP_SECRET'],
  paysera: ['PAYSERA_PROJECT_ID', 'PAYSERA_SIGN_PASSWORD'],
  easypos: ['EASYPOS_API_KEY'],
  fature_al: ['FATURE_AL_API_KEY'],
  vapi: ['VAPI_API_KEY'],
  resend: ['RESEND_API_KEY'],
  ai: ['OPENROUTER_API_KEY'],
  telegram: ['TELEGRAM_BOT_TOKEN'],
  ical: [],
};

export function envReady(provider: string) {
  return (providerEnv[provider] ?? []).every((k) => Boolean(process.env[k]));
}
