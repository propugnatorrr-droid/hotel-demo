-- Re-run this file after every `npm run db:push` (it is idempotent).
-- Server code uses Drizzle with the DB owner role (bypasses RLS) and must always scope by org_id.
-- These policies protect direct Supabase access from the browser (Realtime, Storage, supabase-js).

create or replace function public.try_uuid(v text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return v::uuid;
exception when others then
  return null;
end;

$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_super_admin
  );

$$;

create or replace function public.is_org_member(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target is not null and (
    exists (
      select 1 from public.memberships m
      where m.org_id = target
        and m.user_id = (select auth.uid())
        and m.is_active
    )
    or public.is_super_admin()
  );

$$;

create or replace function public.has_org_role(target uuid, roles public.member_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select target is not null and (
    exists (
      select 1 from public.memberships m
      where m.org_id = target
        and m.user_id = (select auth.uid())
        and m.is_active
        and m.role = any (roles)
    )
    or public.is_super_admin()
  );

$$;

create or replace function public.shares_org_with(other_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships a
    join public.memberships b on a.org_id = b.org_id
    where a.user_id = (select auth.uid())
      and b.user_id = other_user
      and a.is_active
  );

$$;

-- Every table with an org_id column: members of that org can read.
do $$
declare
  t record;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables tb
      on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'org_id'
      and tb.table_type = 'BASE TABLE'
  loop
    execute format('alter table public.%I enable row level security', t.table_name);
    execute format('drop policy if exists "members can read" on public.%I', t.table_name);
    execute format(
      'create policy "members can read" on public.%I for select to authenticated using (public.is_org_member(org_id))',
      t.table_name
    );
  end loop;
end $$;

-- Organizations
alter table public.organizations enable row level security;
drop policy if exists "members can read" on public.organizations;
create policy "members can read" on public.organizations
  for select to authenticated
  using (public.is_org_member(id));

-- Profiles: yourself + people in your orgs
alter table public.profiles enable row level security;
drop policy if exists "self and teammates can read" on public.profiles;
create policy "self and teammates can read" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.shares_org_with(id) or public.is_super_admin());
