do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'daily_rates'
  ) then
    alter publication supabase_realtime add table public.daily_rates;
  end if;
end $$;
