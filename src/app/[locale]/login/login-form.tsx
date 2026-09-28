'use client';

import { Loader2, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { DEMO_ROLES, type DemoRole } from '@/config/demo';
import { signIn, signInDemo, type AuthError, type AuthState } from '@/server/actions/auth';

type Props = { next?: string; initialError?: AuthError; demoEnabled: boolean };

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending && <Loader2 className="animate-spin" />}
      {pending ? pendingLabel : label}
    </Button>
  );
}

function DemoButton({ role, label }: { role: DemoRole; label: string }) {
  const { pending, data } = useFormStatus();
  const isThis = pending && data?.get('role') === role;
  return (
    <Button type="submit" name="role" value={role} variant="secondary" size="sm" disabled={pending} className="rounded-full">
      {isThis && <Loader2 className="animate-spin" />}
      {label}
    </Button>
  );
}

export function LoginForm({ next, initialError, demoEnabled }: Props) {
  const t = useTranslations('auth');
  const tRoles = useTranslations('roles');
  const [state, action] = useActionState<AuthState, FormData>(signIn, { error: initialError });
  const [demoState, demoAction] = useActionState<AuthState, FormData>(signInDemo, {});
  const error = demoState.error ?? state.error;

  return (
    <div className="animate-fade-up mt-10 [animation-delay:120ms]">
      {error && (
        <p role="alert" className="mb-5 rounded-md bg-danger-soft px-3 py-2.5 text-sm text-danger">
          {t(`errors.${error}`)}
        </p>
      )}

      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next ?? ''} />
        <div className="space-y-1.5">
          <Label htmlFor="email">{t('email')}</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">{t('password')}</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required />
        </div>
        <div className="pt-2">
          <SubmitButton label={t('submit')} pendingLabel={t('submitting')} />
        </div>
      </form>

      {demoEnabled && (
        <>
          <div className="my-8 flex items-center gap-3 text-xs text-subtle">
            <span className="h-px flex-1 bg-border" />
            {t('or')}
            <span className="h-px flex-1 bg-border" />
          </div>
          <div className="ai-glow rounded-lg p-5">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="size-4 text-accent" />
              {t('demoTitle')}
            </p>
            <p className="mt-1 text-sm text-muted">{t('demoSubtitle')}</p>
            <form action={demoAction} className="mt-4 flex flex-wrap gap-2">
              {DEMO_ROLES.map((role) => (
                <DemoButton key={role} role={role} label={tRoles(role)} />
              ))}
            </form>
          </div>
        </>
      )}
    </div>
  );
}
