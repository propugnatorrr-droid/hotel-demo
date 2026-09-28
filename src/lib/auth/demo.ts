import 'server-only';

export function isDemoLoginEnabled() {
  return process.env.DEMO_LOGIN_ENABLED !== 'false' && Boolean(process.env.DEMO_PASSWORD);
}
