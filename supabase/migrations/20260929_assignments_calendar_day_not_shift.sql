-- Stocko 2026-09-29
-- Assignments are calendar-day tasks. They must never depend on business shifts.

alter table public.task_occurrences
  drop constraint if exists task_occurrences_assignment_id_assigned_to_scheduled_date_key;

drop index if exists public.task_occurrences_assignment_assignee_shift_uidx;
drop index if exists public.task_occurrences_legacy_daily_uidx;

create unique index if not exists task_occurrences_assignment_assignee_date_uidx
  on public.task_occurrences(assignment_id, assigned_to, scheduled_date);

create or replace function public.ensure_task_occurrences(p_branch_id uuid, p_for_date date default current_date)
returns integer language plpgsql security definer set search_path=public as $$
declare
  me record; inserted_count integer := 0; caller_is_manager boolean := false;
begin
  select * into me from public.stocko_current_user() limit 1;
  if me.id is null then raise exception 'Not authenticated'; end if;
  caller_is_manager := lower(coalesce(me.role,'')) in ('developer','master','admin','manager','owner');

  if caller_is_manager and lower(coalesce(me.role,'')) not in ('developer','master','owner') and me.branch_id is distinct from p_branch_id then
    raise exception 'You are not allowed to generate occurrences for this branch';
  end if;

  insert into public.task_occurrences(assignment_id,branch_id,assigned_to,scheduled_date,scheduled_at,status,shift_id)
  select a.id,a.branch_id,aa.user_id,p_for_date,
         case when coalesce(a.scheduled_time,a.start_time) is null
              then p_for_date::timestamp at time zone 'Asia/Karachi'
              else (p_for_date + coalesce(a.scheduled_time,a.start_time)) at time zone 'Asia/Karachi' end,
         'pending',null
  from public.assignments a
  join public.assignment_assignees aa on aa.assignment_id=a.id
  where a.branch_id=p_branch_id and coalesce(a.active,true)=true
    and (caller_is_manager or aa.user_id=me.id)
    and (a.start_date is null or a.start_date <= p_for_date)
    and (a.end_date is null or a.end_date >= p_for_date)
    and (
      coalesce(a.recurrence,'daily')='daily'
      or (coalesce(a.recurrence,'daily') in ('one_time','scheduled') and (a.scheduled_date is null or a.scheduled_date=p_for_date))
      or (a.recurrence='weekly' and (
        a.days_of_week is null
        or jsonb_array_length(coalesce(to_jsonb(a.days_of_week),'[]'::jsonb))=0
        or lower(to_char(p_for_date,'Dy')) in (
          select lower(trim(both '"' from value::text))
          from jsonb_array_elements(coalesce(to_jsonb(a.days_of_week),'[]'::jsonb))
        )
      ))
    )
  on conflict (assignment_id,assigned_to,scheduled_date) do nothing;
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

  -- Time is used for status/reporting only. It never blocks completion.
  update public.task_occurrences
  set status='completed',completed_at=coalesce(completed_at,now()),updated_at=now(),shift_id=null
  where id=p_occurrence_id returning * into occ;

  insert into public.task_reports(task_occurrence_id,assignment_id,assigned_to,branch_id,scheduled_date,report_text,proof_url)
  values(occ.id,occ.assignment_id,occ.assigned_to,occ.branch_id,occ.scheduled_date,nullif(btrim(coalesce(p_report_text,'')),''),p_proof_url)
  on conflict(task_occurrence_id) do update set report_text=excluded.report_text,proof_url=coalesce(excluded.proof_url,public.task_reports.proof_url),updated_at=now()
  returning * into rep;
  return jsonb_build_object('occurrence',to_jsonb(occ),'report',to_jsonb(rep));
end; $$;
grant execute on function public.complete_task_occurrence(uuid,text,text) to authenticated;
