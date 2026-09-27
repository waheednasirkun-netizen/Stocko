-- Stocko: assignments must be performed once per business shift and never before scheduled time.
alter table public.task_occurrences add column if not exists shift_id uuid references public.business_shifts(id) on delete set null;

-- The old daily uniqueness prevents two shifts on the same calendar date from each receiving a task.
alter table public.task_occurrences drop constraint if exists task_occurrences_assignment_id_assigned_to_scheduled_date_key;
create unique index if not exists task_occurrences_assignment_assignee_shift_uidx
  on public.task_occurrences(assignment_id, assigned_to, shift_id)
  where shift_id is not null;
create unique index if not exists task_occurrences_legacy_daily_uidx
  on public.task_occurrences(assignment_id, assigned_to, scheduled_date)
  where shift_id is null;

create or replace function public.ensure_task_occurrences(p_branch_id uuid, p_for_date date default current_date)
returns integer language plpgsql security definer set search_path=public as $$
declare
  me record; inserted_count integer := 0; caller_is_manager boolean := false;
  v_shift public.business_shifts; v_open_local timestamp; v_task_time time; v_candidate timestamp;
begin
  select * into me from public.stocko_current_user() limit 1;
  if me.id is null then raise exception 'Not authenticated'; end if;
  caller_is_manager := lower(coalesce(me.role,'')) in ('developer','master','admin','manager','owner');
  if caller_is_manager and lower(coalesce(me.role,'')) not in ('developer','master','owner') and me.branch_id is distinct from p_branch_id then
    raise exception 'You are not allowed to generate occurrences for this branch';
  end if;

  select * into v_shift from public.business_shifts
   where branch_id=p_branch_id and status='open' order by opened_at desc limit 1;
  if v_shift.id is null then
    select * into v_shift from public.ensure_current_business_shift(p_branch_id);
  end if;
  v_open_local := v_shift.opened_at at time zone 'Asia/Karachi';

  insert into public.task_occurrences(assignment_id,branch_id,assigned_to,scheduled_date,scheduled_at,status,shift_id)
  select a.id,a.branch_id,aa.user_id,
         (case when coalesce(a.scheduled_time,a.start_time) is not null
                    and (date(v_open_local) + coalesce(a.scheduled_time,a.start_time)) < v_open_local
                then date(v_open_local)+1 else date(v_open_local) end),
         (case when coalesce(a.scheduled_time,a.start_time) is null then v_shift.opened_at
               else ((case when (date(v_open_local)+coalesce(a.scheduled_time,a.start_time)) < v_open_local
                           then date(v_open_local)+1 else date(v_open_local) end)
                     + coalesce(a.scheduled_time,a.start_time)) at time zone 'Asia/Karachi' end),
         'pending',v_shift.id
  from public.assignments a join public.assignment_assignees aa on aa.assignment_id=a.id
  where a.branch_id=p_branch_id and coalesce(a.active,true)=true and (caller_is_manager or aa.user_id=me.id)
    and (a.start_date is null or a.start_date <= date(v_open_local))
    and (a.end_date is null or a.end_date >= date(v_open_local))
    -- Every active assignment is required once in every business shift.
  on conflict do nothing;
  get diagnostics inserted_count=row_count;
  return inserted_count;
end; $$;
grant execute on function public.ensure_task_occurrences(uuid,date) to authenticated;

create or replace function public.complete_task_occurrence(p_occurrence_id uuid,p_report_text text default '',p_proof_url text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare me record; occ public.task_occurrences; rep public.task_reports;
begin
  select * into me from public.stocko_current_user() limit 1;
  select * into occ from public.task_occurrences where id=p_occurrence_id;
  if occ.id is null then raise exception 'Task occurrence not found'; end if;
  if occ.assigned_to <> me.id then
    if lower(coalesce(me.role,'')) not in ('developer','master','admin','manager','owner') then raise exception 'You can only complete your own assignment'; end if;
    if lower(coalesce(me.role,'')) not in ('developer','master','owner') and me.branch_id is distinct from occ.branch_id then raise exception 'You cannot complete assignments for another branch'; end if;
  end if;
  if occ.scheduled_at is not null and clock_timestamp() < occ.scheduled_at then
    raise exception 'This task cannot be submitted before its scheduled start time (%)', to_char(occ.scheduled_at at time zone 'Asia/Karachi','DD Mon YYYY HH12:MI AM');
  end if;
  update public.task_occurrences set status='completed',completed_at=coalesce(completed_at,now()),updated_at=now() where id=p_occurrence_id returning * into occ;
  insert into public.task_reports(task_occurrence_id,assignment_id,assigned_to,branch_id,scheduled_date,report_text,proof_url)
  values(occ.id,occ.assignment_id,occ.assigned_to,occ.branch_id,occ.scheduled_date,nullif(btrim(coalesce(p_report_text,'')),''),p_proof_url)
  on conflict(task_occurrence_id) do update set report_text=excluded.report_text,proof_url=coalesce(excluded.proof_url,public.task_reports.proof_url),updated_at=now()
  returning * into rep;
  return jsonb_build_object('occurrence',to_jsonb(occ),'report',to_jsonb(rep));
end; $$;
grant execute on function public.complete_task_occurrence(uuid,text,text) to authenticated;


-- Only Admin and Developer may permanently delete an assignment.
create or replace function public.delete_assignment_admin_developer(p_assignment_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare me record; v_branch uuid;
begin
  select * into me from public.stocko_current_user() limit 1;
  if lower(coalesce(me.role,'')) not in ('admin','developer') then raise exception 'Only Admin or Developer can delete assignments'; end if;
  select branch_id into v_branch from public.assignments where id=p_assignment_id;
  if v_branch is null then raise exception 'Assignment not found'; end if;
  if lower(coalesce(me.role,''))='admin' and me.branch_id is distinct from v_branch then raise exception 'Admin can delete assignments only in their own branch'; end if;
  delete from public.task_reports where assignment_id=p_assignment_id;
  delete from public.task_occurrences where assignment_id=p_assignment_id;
  delete from public.assignment_assignees where assignment_id=p_assignment_id;
  delete from public.assignment_managers where assignment_id=p_assignment_id;
  delete from public.assignment_completions where assignment_id=p_assignment_id;
  delete from public.assignments where id=p_assignment_id;
  return true;
end; $$;
grant execute on function public.delete_assignment_admin_developer(uuid) to authenticated;
