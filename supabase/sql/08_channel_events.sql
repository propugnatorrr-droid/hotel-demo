do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'channel_events'
  ) then
    alter publication supabase_realtime add table public.channel_events;
  end if;
end $$;
