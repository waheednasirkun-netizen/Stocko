-- Stocko 2026-09-27
-- Fix personal assignment occurrence generation without granting staff branch-admin rights.
-- Safe to run more than once.

create table if not exists public.task_occurrences (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  assigned_to uuid not null references public.users(id) on delete cascade,
  scheduled_date date not null,
  scheduled_at timestamptz,
  status text not null default 'pending',
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, assigned_to, scheduled_date)
);

create table if not exists public.task_reports (
  id uuid primary key default gen_random_uuid(),
  task_occurrence_id uuid not null references public.task_occurrences(id) on delete cascade,
  assignment_id uuid references public.assignments(id) on delete cascade,
  assigned_to uuid references public.users(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete cascade,
  scheduled_date date,
  report_text text,
  proof_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (task_occurrence_id)
);

alter table public.task_occurrences enable row level security;
alter table public.task_reports enable row level security;

drop policy if exists task_occurrences_read on public.task_occurrences;
create policy task_occurrences_read on public.task_occurrences
for select to authenticated using (
  exists (
    select 1 from public.stocko_current_user() me
    where task_occurrences.assigned_to = me.id
       or lower(coalesce(me.role,'')) in ('developer','master','admin','manager','owner')
  )
);

drop policy if exists task_reports_read on public.task_reports;
create policy task_reports_read on public.task_reports
for select to authenticated using (
  exists (
    select 1 from public.stocko_current_user() me
    where task_reports.assigned_to = me.id
       or lower(coalesce(me.role,'')) in ('developer','master','admin','manager','owner')
  )
);

-- SECURITY DEFINER is intentional: the function validates the caller and then
-- creates only legitimate assignment/assignee occurrences.
create or replace function public.ensure_task_occurrences(
  p_branch_id uuid,
  p_for_date date default current_date
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  me record;
  inserted_count integer := 0;
  caller_is_manager boolean := false;
begin
  select * into me from public.stocko_current_user() limit 1;
  if me.id is null then raise exception 'Not authenticated'; end if;

  caller_is_manager := lower(coalesce(me.role,'')) in ('developer','master','admin','manager','owner');

  -- Management can generate branch occurrences according to branch scope.
  -- Ordinary staff can call this function too, but INSERT below is restricted
  -- to assignment_assignees.user_id = their own public.users.id.
  if caller_is_manager
     and lower(coalesce(me.role,'')) not in ('developer','master','owner')
     and me.branch_id is distinct from p_branch_id then
    raise exception 'You are not allowed to generate occurrences for this branch';
  end if;

  insert into public.task_occurrences (
    assignment_id, branch_id, assigned_to, scheduled_date, scheduled_at, status
  )
  select
    a.id,
    a.branch_id,
    aa.user_id,
    p_for_date,
    case
      when coalesce(a.scheduled_time, a.start_time) is null then p_for_date::timestamp at time zone 'Asia/Karachi'
      else (p_for_date + coalesce(a.scheduled_time, a.start_time)) at time zone 'Asia/Karachi'
    end,
    'pending'
  from public.assignments a
  join public.assignment_assignees aa on aa.assignment_id = a.id
  where a.branch_id = p_branch_id
    and coalesce(a.active, true) = true
    and (caller_is_manager or aa.user_id = me.id)
    and (a.start_date is null or a.start_date <= p_for_date)
    and (a.end_date is null or a.end_date >= p_for_date)
    and (
      coalesce(a.recurrence, 'daily') = 'daily'
      or (coalesce(a.recurrence, 'daily') in ('one_time','scheduled') and (a.scheduled_date is null or a.scheduled_date = p_for_date))
      or (
        a.recurrence = 'weekly'
        and (
          a.days_of_week is null
          or jsonb_array_length(coalesce(to_jsonb(a.days_of_week), '[]'::jsonb)) = 0
          or lower(to_char(p_for_date, 'Dy')) in (
            select lower(trim(both '"' from value::text))
            from jsonb_array_elements(coalesce(to_jsonb(a.days_of_week), '[]'::jsonb))
          )
        )
      )
    )
  on conflict (assignment_id, assigned_to, scheduled_date) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

grant execute on function public.ensure_task_occurrences(uuid,date) to authenticated;

create or replace function public.start_task_occurrence(p_occurrence_id uuid)
returns public.task_occurrences
language plpgsql
security definer
set search_path = public
as $$
declare
  me record;
  occ public.task_occurrences;
begin
  select * into me from public.stocko_current_user() limit 1;
  select * into occ from public.task_occurrences where id = p_occurrence_id;
  if occ.id is null then raise exception 'Task occurrence not found'; end if;
  if occ.assigned_to <> me.id and lower(coalesce(me.role,'')) not in ('developer','master','admin','manager','owner') then
    raise exception 'You can only start your own assignment';
  end if;
  update public.task_occurrences
  set status = case when status = 'pending' then 'in_progress' else status end,
      started_at = coalesce(started_at, now()), updated_at = now()
  where id = p_occurrence_id
  returning * into occ;
  return occ;
end;
$$;

grant execute on function public.start_task_occurrence(uuid) to authenticated;

create or replace function public.complete_task_occurrence(
  p_occurrence_id uuid,
  p_report_text text default '',
  p_proof_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me record;
  occ public.task_occurrences;
  rep public.task_reports;
begin
  select * into me from public.stocko_current_user() limit 1;
  select * into occ from public.task_occurrences where id = p_occurrence_id;
  if occ.id is null then raise exception 'Task occurrence not found'; end if;

  -- Staff can complete only their own row. Management may complete rows they can administer.
  if occ.assigned_to <> me.id then
    if lower(coalesce(me.role,'')) not in ('developer','master','admin','manager','owner') then
      raise exception 'You can only complete your own assignment';
    end if;
    if lower(coalesce(me.role,'')) not in ('developer','master','owner') and me.branch_id is distinct from occ.branch_id then
      raise exception 'You cannot complete assignments for another branch';
    end if;
  end if;

  update public.task_occurrences
  set status = 'completed', completed_at = coalesce(completed_at, now()), updated_at = now()
  where id = p_occurrence_id
  returning * into occ;

  insert into public.task_reports (
    task_occurrence_id, assignment_id, assigned_to, branch_id, scheduled_date, report_text, proof_url
  ) values (
    occ.id, occ.assignment_id, occ.assigned_to, occ.branch_id, occ.scheduled_date,
    nullif(btrim(coalesce(p_report_text,'')), ''), p_proof_url
  )
  on conflict (task_occurrence_id) do update
    set report_text = excluded.report_text,
        proof_url = coalesce(excluded.proof_url, public.task_reports.proof_url),
        updated_at = now()
  returning * into rep;

  return jsonb_build_object('occurrence', to_jsonb(occ), 'report', to_jsonb(rep));
end;
$$;

grant execute on function public.complete_task_occurrence(uuid,text,text) to authenticated;
