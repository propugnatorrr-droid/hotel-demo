'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getLocale } from 'next-intl/server';
import { z } from 'zod';
import { DEMO_ACCOUNTS, DEMO_ROLES } from '@/config/demo';
import { ACTIVE_ORG_COOKIE } from '@/lib/auth/session';
import { isSupabaseConfigured } from '@/lib/env';
import { localePath, safeNext } from '@/lib/paths';
import { createClient } from '@/lib/supabase/server';

export type AuthError = 'invalid' | 'missing' | 'notConfigured' | 'demoDisabled' | 'noMembership';
export type AuthState = { error?: AuthError };

const credentials = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured) return { error: 'notConfigured' };

  const parsed = credentials.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) return { error: 'missing' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: 'invalid' };

  const locale = await getLocale();
  redirect(safeNext(formData.get('next'), localePath(locale, '/app')));
}

export async function signInDemo(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured) return { error: 'notConfigured' };

  const password = process.env.DEMO_PASSWORD;
  if (process.env.DEMO_LOGIN_ENABLED === 'false' || !password) return { error: 'demoDisabled' };

  const role = z.enum(DEMO_ROLES).safeParse(formData.get('role'));
  if (!role.success) return { error: 'missing' };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: DEMO_ACCOUNTS[role.data], password });
  if (error) return { error: 'invalid' };

  (await cookies()).delete(ACTIVE_ORG_COOKIE);
  const locale = await getLocale();
  redirect(localePath(locale, '/app'));
}

export async function signOut() {
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  (await cookies()).delete(ACTIVE_ORG_COOKIE);
  const locale = await getLocale();
  redirect(localePath(locale, '/login'));
}
