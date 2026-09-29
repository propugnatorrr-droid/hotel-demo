'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Check, TrendingUp } from 'lucide-react';
import { applyPricingSuggestion, resolveAlert } from '@/server/actions/alerts';

/** Resolve / one-click apply for an alert. Only rendered for managers. */
export function AlertActions({ id, type, canApply, locale }: { id: string; type: string; canApply: boolean; locale: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);
  const en = locale === 'en';
  const done = () => router.refresh();

  return (
    <div className="mt-2 flex items-center gap-2">
      {type === 'pricing_suggestion' && canApply && (
        <button type="button" disabled={pending} onClick={() => start(async () => { const r = await applyPricingSuggestion(id); if (r.ok) done(); else setError(true); })} className="ai-glow inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-medium">
          <TrendingUp className="size-3" /> {en ? 'Apply' : 'Apliko'}
        </button>
      )}
      <button type="button" disabled={pending} onClick={() => start(async () => { const r = await resolveAlert(id); if (r.ok) done(); else setError(true); })} className="inline-flex h-7 items-center gap-1 rounded-full border border-border-strong px-2.5 text-[11px] text-muted hover:bg-surface-2">
        <Check className="size-3" /> {en ? 'Resolve' : 'Zgjidhe'}
      </button>
      {error && <span className="text-[11px] text-danger">!</span>}
    </div>
  );
}
