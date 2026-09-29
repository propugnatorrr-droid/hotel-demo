'use client';

import { useState, useTransition } from 'react';
import { completeMockPayment } from '@/server/actions/public';

export function MockPayButton({ slug, code, token, locale, label, busy, disabled }: { slug: string; code: string; token: string; locale: string; label: string; busy: string; disabled?: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mt-6">
      <button
        type="button"
        disabled={pending || disabled}
        onClick={() =>
          start(async () => {
            const res = await completeMockPayment({ slug, code, token, locale });
            if (!res.ok) return setError(res.error);
            window.location.assign(res.data.redirect);
          })
        }
        className="h-12 w-full rounded-full bg-ionian-900 text-sm font-medium text-limestone-50 transition-transform hover:-translate-y-0.5 disabled:opacity-50"
      >
        {pending ? busy : label}
      </button>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
