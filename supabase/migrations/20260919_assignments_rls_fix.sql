-- Fix RLS for the multi-user assignment system.
-- Uses Stocko's existing stocko_current_user() helper so auth.uid() works
-- whether public.users.id is the auth UUID or users.auth_id stores it.

create or replace function public.stocko_current_user()
returns table(id uuid, role text, branch_id uuid)
language sql
security definer
stable
set search_path = public
as $$
  select u.id, u.role, u.branch_id
  from public.users u
  where u.auth_id = auth.uid() or u.id = auth.uid()
  order by case when u.auth_id = auth.uid() then 0 else 1 end
  limit 1;
$$;

grant execute on function public.stocko_current_user() to authenticated;

-- ASSIGNMENT TEMPLATES -------------------------------------------------------
alter table if exists public.assignments enable row level security;

drop policy if exists assignments_read on public.assignments;
create policy assignments_read on public.assignments
for select to authenticated
using (
  exists (
    select 1 from public.stocko_current_user() me
    where lower(coalesce(me.role, '')) in ('master','developer','admin','owner')
       or me.branch_id = assignments.branch_id
  )
);

drop policy if exists assignments_manage on public.assignments;
create policy assignments_manage on public.assignments
for all to authenticated
using (
  exists (
    select 1 from public.stocko_current_user() me
    where lower(coalesce(me.role, '')) in ('master','developer','admin','owner')
      and (lower(coalesce(me.role, '')) in ('master','developer') or me.branch_id = assignments.branch_id)
  )
)
with check (
  exists (
    select 1 from public.stocko_current_user() me
    where lower(coalesce(me.role, '')) in ('master','developer','admin','owner')
      and (lower(coalesce(me.role, '')) in ('master','developer') or me.branch_id = assignments.branch_id)
  )
);

-- ASSIGNEE LINKS ------------------------------------------------------------
alter table if exists public.assignment_assignees enable row level security;

drop policy if exists assignment_assignees_read on public.assignment_assignees;
create policy assignment_assignees_read on public.assignment_assignees
for select to authenticated
using (
  exists (
    select 1
    from public.assignments a
    join public.stocko_current_user() me on true
    where a.id = assignment_assignees.assignment_id
      and (
        lower(coalesce(me.role, '')) in ('master','developer','admin','owner')
        or me.branch_id = a.branch_id
        or assignment_assignees.user_id = me.id
      )
  )
);

drop policy if exists assignment_assignees_manage on public.assignment_assignees;
create policy assignment_assignees_manage on public.assignment_assignees
for all to authenticated
using (
  exists (
    select 1
    from public.assignments a
    join public.stocko_current_user() me on true
    where a.id = assignment_assignees.assignment_id
      and lower(coalesce(me.role, '')) in ('master','developer','admin','owner')
      and (lower(coalesce(me.role, '')) in ('master','developer') or me.branch_id = a.branch_id)
  )
)
with check (
  exists (
    select 1
    from public.assignments a
    join public.stocko_current_user() me on true
    where a.id = assignment_assignees.assignment_id
      and lower(coalesce(me.role, '')) in ('master','developer','admin','owner')
      and (lower(coalesce(me.role, '')) in ('master','developer') or me.branch_id = a.branch_id)
  )
);

-- COMPLETIONS ----------------------------------------------------------------
alter table if exists public.assignment_completions enable row level security;

drop policy if exists assignment_completions_read on public.assignment_completions;
create policy assignment_completions_read on public.assignment_completions
for select to authenticated
using (
  exists (
    select 1 from public.stocko_current_user() me
    where lower(coalesce(me.role, '')) in ('master','developer','admin','owner')
       or assignment_completions.assigned_to = me.id
       or me.branch_id = assignment_completions.branch_id
  )
);

drop policy if exists assignment_completions_insert on public.assignment_completions;
create policy assignment_completions_insert on public.assignment_completions
for insert to authenticated
with check (
  exists (
    select 1
    from public.stocko_current_user() me
    where (
      assignment_completions.assigned_to = me.id
      and me.branch_id = assignment_completions.branch_id
    )
    or (
      lower(coalesce(me.role, '')) in ('master','developer','admin','owner')
      and (lower(coalesce(me.role, '')) in ('master','developer') or me.branch_id = assignment_completions.branch_id)
    )
  )
  and exists (
    select 1 from public.assignment_assignees aa
    where aa.assignment_id = assignment_completions.assignment_id
      and aa.user_id = assignment_completions.assigned_to
  )
);

drop policy if exists assignment_completions_update on public.assignment_completions;
create policy assignment_completions_update on public.assignment_completions
for update to authenticated
using (
  exists (
    select 1 from public.stocko_current_user() me
    where assignment_completions.assigned_to = me.id
       or lower(coalesce(me.role, '')) in ('master','developer','admin','owner')
  )
)
with check (
  exists (
    select 1 from public.stocko_current_user() me
    where assignment_completions.assigned_to = me.id
       or (
         lower(coalesce(me.role, '')) in ('master','developer','admin','owner')
         and (lower(coalesce(me.role, '')) in ('master','developer') or me.branch_id = assignment_completions.branch_id)
       )
  )
);
