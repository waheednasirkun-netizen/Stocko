-- Shared cloud print queue for POS and fulfilment receipts.
-- Safe to run more than once; no existing table or data is dropped.

create table if not exists public.print_jobs (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  requested_by uuid not null default auth.uid(),
  payload jsonb not null,
  status text not null default 'pending'
    check (status in ('pending', 'claimed', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  error_message text,
  attempts integer not null default 0 check (attempts >= 0)
);

-- Preserve an existing production queue while adding only missing fields.
alter table public.print_jobs add column if not exists id uuid default gen_random_uuid();
alter table public.print_jobs add column if not exists branch_id uuid references public.branches(id);
alter table public.print_jobs add column if not exists requested_by uuid default auth.uid();
alter table public.print_jobs add column if not exists payload jsonb;
alter table public.print_jobs add column if not exists status text default 'pending';
alter table public.print_jobs add column if not exists created_at timestamptz default now();
alter table public.print_jobs add column if not exists claimed_at timestamptz;
alter table public.print_jobs add column if not exists completed_at timestamptz;
alter table public.print_jobs add column if not exists failed_at timestamptz;
alter table public.print_jobs add column if not exists error_message text;
alter table public.print_jobs add column if not exists attempts integer default 0;

alter table public.print_jobs alter column requested_by set default auth.uid();
alter table public.print_jobs alter column status set default 'pending';
alter table public.print_jobs alter column created_at set default now();
alter table public.print_jobs alter column attempts set default 0;

create index if not exists print_jobs_branch_status_created_idx
  on public.print_jobs (branch_id, status, created_at);

alter table public.print_jobs enable row level security;

-- Resolve the authenticated Stocko profile and check its default branch.
-- When the optional multi-branch table exists, memberships are accepted too.
create or replace function public.can_enqueue_print_job(target_branch_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  profile_id uuid;
  profile_branch_id uuid;
  has_membership boolean := false;
begin
  select u.id, u.branch_id
    into profile_id, profile_branch_id
  from public.users u
  where u.auth_id = auth.uid() or u.id = auth.uid()
  limit 1;

  if profile_id is null then
    return false;
  end if;

  if profile_branch_id = target_branch_id then
    return true;
  end if;

  if to_regclass('public.branch_members') is not null then
    execute
      'select exists (
         select 1
         from public.branch_members
         where user_id = $1 and branch_id = $2
       )'
      into has_membership
      using profile_id, target_branch_id;
  end if;

  return has_membership;
end;
$$;

revoke all on function public.can_enqueue_print_job(uuid) from public;
grant execute on function public.can_enqueue_print_job(uuid) to authenticated;

drop policy if exists "print_jobs_insert_permitted_branch" on public.print_jobs;
create policy "print_jobs_insert_permitted_branch"
  on public.print_jobs
  for insert
  to authenticated
  with check (
    public.can_enqueue_print_job(branch_id)
    and requested_by = auth.uid()
    and status = 'pending'
    and attempts = 0
  );

-- Required for `.insert(...).select().single()` to return the queued row.
drop policy if exists "print_jobs_select_permitted_branch" on public.print_jobs;
create policy "print_jobs_select_permitted_branch"
  on public.print_jobs
  for select
  to authenticated
  using (
    requested_by = auth.uid()
    and public.can_enqueue_print_job(branch_id)
  );

-- No authenticated-client update/delete policy is intentionally granted.
-- A trusted desktop printer agent should claim and update jobs with a securely
-- stored service-role credential, which bypasses RLS. Never expose that key in
-- this frontend.
