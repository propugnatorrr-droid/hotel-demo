import 'server-only';

export * from './types';
export { channexAdapter } from './channex';
export { buildMockRevision, mockAdapter } from './mock';

type IntegrationLike = {
  mode: 'mock' | 'sandbox' | 'live';
  isEnabled: boolean;
  externalAccountId: string | null;
} | null | undefined;

/** mock unless: integration enabled + mode sandbox/live + server API key + Channex property id */
export function resolveChannelMode(integ: IntegrationLike, hasKey = Boolean(process.env.CHANNEX_API_KEY)) {
  const configured: 'mock' | 'sandbox' | 'live' = integ?.mode ?? 'mock';
  const effective: 'mock' | 'channex' =
    integ && integ.isEnabled && configured !== 'mock' && hasKey && integ.externalAccountId ? 'channex' : 'mock';
  return { configured, effective };
}
