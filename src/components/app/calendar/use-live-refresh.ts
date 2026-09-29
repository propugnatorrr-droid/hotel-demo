'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { isSupabaseConfigured } from '@/lib/env';
import { createClient } from '@/lib/supabase/client';

/** Refreshes server data when any of the tables change for this org (Supabase Realtime + RLS). */
export function useLiveRefresh(orgId: string, tables: readonly string[]) {
  const router = useRouter();
  const [live, setLive] = useState(false);
  const key = tables.join(',');

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 400);
    };

    const channel = supabase.channel(`live:${orgId}:${key}`);
    for (const table of key.split(',')) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `org_id=eq.${orgId}` }, refresh);
    }
    channel.subscribe((status) => setLive(status === 'SUBSCRIBED'));

    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [orgId, key, router]);

  return live;
}
