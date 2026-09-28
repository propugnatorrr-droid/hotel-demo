-- File paths must start with the org id: {org_id}/...
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('guest-documents', 'guest-documents', false, 10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']),
  ('receipts', 'receipts', false, 10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']),
  ('invoices', 'invoices', false, 5242880,
    array['application/pdf']),
  ('media', 'media', true, 10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_access_org_file(bucket text, path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    -- Passports / IDs: only owner, manager, receptionist
    when bucket = 'guest-documents' then public.has_org_role(
      public.try_uuid((storage.foldername(path))[1]),
      array['owner', 'manager', 'receptionist']::public.member_role[]
    )
    when bucket in ('receipts', 'invoices', 'media') then public.is_org_member(
      public.try_uuid((storage.foldername(path))[1])
    )
    else false
  end;

$$;

drop policy if exists "iliria: read org files" on storage.objects;
create policy "iliria: read org files" on storage.objects
  for select to authenticated
  using (public.can_access_org_file(bucket_id, name));

drop policy if exists "iliria: upload org files" on storage.objects;
create policy "iliria: upload org files" on storage.objects
  for insert to authenticated
  with check (public.can_access_org_file(bucket_id, name));

drop policy if exists "iliria: update org files" on storage.objects;
create policy "iliria: update org files" on storage.objects
  for update to authenticated
  using (public.can_access_org_file(bucket_id, name))
  with check (public.can_access_org_file(bucket_id, name));

drop policy if exists "iliria: delete org files" on storage.objects;
create policy "iliria: delete org files" on storage.objects
  for delete to authenticated
  using (public.can_access_org_file(bucket_id, name));
