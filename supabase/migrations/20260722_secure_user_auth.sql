-- Required by the secure create-user/update-user Edge Functions.
-- This migration does not delete any existing legacy password values.

alter table if exists public.users add column if not exists auth_id uuid;
alter table if exists public.users add column if not exists full_name text;
alter table if exists public.users add column if not exists updated_at timestamptz default now();

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'password'
  ) then
    alter table public.users alter column password drop not null;
  end if;
end $$;

create unique index if not exists users_auth_id_unique
  on public.users (auth_id)
  where auth_id is not null;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'users' and column_name = 'password'
  ) then
    comment on column public.users.password is
      'Legacy column. Never store login passwords here; Supabase Auth owns password hashes.';
  end if;
end $$;
