create extension if not exists btree_gist;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'bookings_dates_chk') then
    alter table public.bookings
      add constraint bookings_dates_chk check (check_out > check_in);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'bookings_no_room_overlap') then
    alter table public.bookings
      add constraint bookings_no_room_overlap
      exclude using gist (
        org_id with =,
        room_id with =,
        daterange(check_in, check_out, '[)') with &&
      )
      where (room_id is not null and status in ('tentative', 'confirmed', 'checked_in'));
  end if;
end $$;
