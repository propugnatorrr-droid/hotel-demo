'use client';

import { useState, useTransition } from 'react';

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

/** Runs a server action, tracks pending state and maps error codes to translated messages. */
export function useAction(errors: Record<string, string>) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function run<T>(fn: () => Promise<Result<T>>, onOk?: (data: T) => void) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error);
      else onOk?.(res.data);
    });
  }
  return { pending, error, message: error ? (errors[error] ?? errors.unknown ?? error) : null, run, clear: () => setError(null) };
}
