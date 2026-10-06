-- RLS policies for public.users (required when Row Level Security is enabled)
-- Run in Supabase SQL Editor if login works in SQL but the app says "No profile found".

-- Allow authenticated users to read their own profile row
drop policy if exists "users_select_own" on public.users;
create policy "users_select_own"
  on public.users
  for select
  to authenticated
  using (auth_id = auth.uid() or id = auth.uid());

-- Optional: allow authenticated users to update their own row (e.g. phone)
drop policy if exists "users_update_own" on public.users;
create policy "users_update_own"
  on public.users
  for update
  to authenticated
  using (auth_id = auth.uid() or id = auth.uid())
  with check (auth_id = auth.uid() or id = auth.uid());

-- Development only — disable RLS entirely (NOT for production):
-- alter table public.users disable row level security;
