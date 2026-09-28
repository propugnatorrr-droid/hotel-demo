-- Live updates for calendar, floor plan, inbox, alerts, POS and spa.
do $$
declare
  t text;
begin
  foreach t in array array[
    'bookings', 'rooms', 'conversations', 'messages', 'alerts',
    'housekeeping_tasks', 'pos_orders', 'spa_appointments'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
