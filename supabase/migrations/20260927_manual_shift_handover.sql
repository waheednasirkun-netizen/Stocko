-- Stocko manual shift close + immediate automatic handover
create table if not exists public.business_shifts (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opened_by uuid references public.users(id) on delete set null,
  closed_by uuid references public.users(id) on delete set null,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now()
);
create unique index if not exists business_shifts_one_open_per_branch on public.business_shifts(branch_id) where status='open';
create index if not exists business_shifts_branch_opened_idx on public.business_shifts(branch_id, opened_at desc);
alter table public.business_shifts enable row level security;

drop policy if exists "business shifts readable by authenticated" on public.business_shifts;
create policy "business shifts readable by authenticated" on public.business_shifts for select to authenticated using (true);

create or replace function public.ensure_current_business_shift(p_branch_id uuid)
returns public.business_shifts
language plpgsql security definer set search_path=public as $$
declare v_shift public.business_shifts; v_uid uuid; begin
  select * into v_shift from public.business_shifts where branch_id=p_branch_id and status='open' order by opened_at desc limit 1;
  if v_shift.id is not null then return v_shift; end if;
  select id into v_uid from public.users where auth_id=auth.uid() limit 1;
  insert into public.business_shifts(branch_id,opened_at,opened_by,status) values(p_branch_id,now(),v_uid,'open') returning * into v_shift;
  return v_shift;
end $$;

create or replace function public.close_business_shift(p_branch_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_role text; v_uid uuid; v_old public.business_shifts; v_new public.business_shifts; v_now timestamptz := clock_timestamp(); begin
  select id, role into v_uid, v_role from public.users where auth_id=auth.uid() limit 1;
  if v_uid is null or lower(coalesce(v_role,'')) not in ('developer','admin','manager') then
    raise exception 'Only Manager, Admin or Developer can close a shift';
  end if;
  select * into v_old from public.business_shifts where branch_id=p_branch_id and status='open' order by opened_at desc limit 1 for update;
  if v_old.id is null then perform public.ensure_current_business_shift(p_branch_id); select * into v_old from public.business_shifts where branch_id=p_branch_id and status='open' order by opened_at desc limit 1 for update; end if;
  update public.business_shifts set closed_at=v_now,closed_by=v_uid,status='closed' where id=v_old.id returning * into v_old;
  insert into public.business_shifts(branch_id,opened_at,opened_by,status) values(p_branch_id,v_now,v_uid,'open') returning * into v_new;
  return jsonb_build_object('closed_shift',to_jsonb(v_old),'new_shift',to_jsonb(v_new));
end $$;

grant execute on function public.ensure_current_business_shift(uuid) to authenticated;
grant execute on function public.close_business_shift(uuid) to authenticated;
