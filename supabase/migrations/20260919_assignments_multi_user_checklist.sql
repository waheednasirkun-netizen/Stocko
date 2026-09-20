-- Stocko assignments: multi-user daily checklist, per-user completion, reporting deadline.
-- Run this migration in Supabase before using the updated assignment UI.

alter table if exists public.assignments
  add column if not exists start_time time,
  add column if not exists deadline_time time;

create table if not exists public.assignment_assignees (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (assignment_id, user_id)
);

-- Migrate existing manager links into the new generic assignee table.
insert into public.assignment_assignees (assignment_id, user_id)
select am.assignment_id, am.manager_id
from public.assignment_managers am
where not exists (
  select 1 from public.assignment_assignees aa
  where aa.assignment_id = am.assignment_id and aa.user_id = am.manager_id
);

insert into public.assignment_assignees (assignment_id, user_id)
select a.id, a.assigned_to
from public.assignments a
where a.assigned_to is not null
  and not exists (
    select 1 from public.assignment_assignees aa
    where aa.assignment_id = a.id and aa.user_id = a.assigned_to
  );

-- A completion belongs to one assignment + one user + one occurrence date.
alter table if exists public.assignment_completions
  add column if not exists assigned_to uuid references public.users(id) on delete cascade;

-- Backfill old completion rows from the legacy assignment owner where possible.
update public.assignment_completions c
set assigned_to = a.assigned_to
from public.assignments a
where c.assignment_id = a.id
  and c.assigned_to is null
  and a.assigned_to is not null;

-- Remove the old one-completion-per-assignment/day uniqueness if it exists.
alter table if exists public.assignment_completions
  drop constraint if exists assignment_completions_assignment_id_scheduled_date_key;

drop index if exists public.assignment_completions_assignment_id_scheduled_date_key;

create unique index if not exists assignment_completions_assignment_date_user_key
  on public.assignment_completions (assignment_id, scheduled_date, assigned_to)
  where assigned_to is not null;

-- Photo proof storage bucket. The app uploads under branch/task/user/date paths.
insert into storage.buckets (id, name, public)
values ('assignment-proofs', 'assignment-proofs', true)
on conflict (id) do update set public = true;

-- Basic authenticated storage policies. Tighten these further if your deployment uses stricter branch RLS.
drop policy if exists "assignment_proofs_authenticated_insert" on storage.objects;
create policy "assignment_proofs_authenticated_insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'assignment-proofs');

drop policy if exists "assignment_proofs_authenticated_select" on storage.objects;
create policy "assignment_proofs_authenticated_select"
on storage.objects for select to authenticated
using (bucket_id = 'assignment-proofs');

drop policy if exists "assignment_proofs_authenticated_update" on storage.objects;
create policy "assignment_proofs_authenticated_update"
on storage.objects for update to authenticated
using (bucket_id = 'assignment-proofs')
with check (bucket_id = 'assignment-proofs');
