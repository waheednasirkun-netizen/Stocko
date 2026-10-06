-- Stocko v9: repair task_occurrences shift linkage required by Assignment History.
-- Safe to run even if the v7 migration was only partially applied.

alter table public.task_occurrences
  add column if not exists shift_id uuid;

-- Add FK separately so an already-created column without a FK is repaired too.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'task_occurrences_shift_id_fkey'
      and conrelid = 'public.task_occurrences'::regclass
  ) then
    alter table public.task_occurrences
      add constraint task_occurrences_shift_id_fkey
      foreign key (shift_id) references public.business_shifts(id) on delete set null;
  end if;
end $$;

create index if not exists task_occurrences_shift_id_idx
  on public.task_occurrences(shift_id);

-- Backfill existing occurrences into the business shift that contained their
-- scheduled/completed timestamp. This keeps after-midnight tasks with the shift
-- that started on the previous calendar date.
update public.task_occurrences o
set shift_id = s.id
from lateral (
  select bs.id
  from public.business_shifts bs
  where bs.branch_id = o.branch_id
    and coalesce(o.scheduled_at, o.completed_at, o.created_at) >= bs.opened_at
    and coalesce(o.scheduled_at, o.completed_at, o.created_at) < coalesce(bs.closed_at, 'infinity'::timestamptz)
  order by bs.opened_at desc
  limit 1
) s
where o.shift_id is null;

-- If an older occurrence has no timestamp inside a shift, use the closest shift
-- whose business start date matches scheduled_date.
update public.task_occurrences o
set shift_id = s.id
from lateral (
  select bs.id
  from public.business_shifts bs
  where bs.branch_id = o.branch_id
    and (bs.opened_at at time zone 'Asia/Karachi')::date = o.scheduled_date
  order by bs.opened_at desc
  limit 1
) s
where o.shift_id is null;

-- Remove the legacy daily uniqueness before enforcing per-shift uniqueness.
alter table public.task_occurrences
  drop constraint if exists task_occurrences_assignment_id_assigned_to_scheduled_date_key;

drop index if exists public.task_occurrences_legacy_daily_uidx;

create unique index if not exists task_occurrences_assignment_assignee_shift_uidx
  on public.task_occurrences(assignment_id, assigned_to, shift_id)
  where shift_id is not null;
