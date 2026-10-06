-- Stocko: Master mirrors Developer permissions except branch creation/edit/delete.

create or replace function public.stocko_is_operator()
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.users u
    where (u.auth_id=auth.uid() or u.id=auth.uid())
      and lower(coalesce(u.role,'')) in ('admin','developer','master')
  ) or exists (
    select 1 from public.user_roles ur join public.users u on u.id=ur.user_id
    where (u.auth_id=auth.uid() or u.id=auth.uid())
      and lower(coalesce(ur.role,'')) in ('admin','developer','master')
  );
$$;

create or replace function public.stocko_can_deactivate_inventory()
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.users u where (u.auth_id=auth.uid() or u.id=auth.uid())
      and lower(coalesce(u.role,'')) in ('manager','admin','developer','master')
  ) or exists (
    select 1 from public.user_roles ur join public.users u on u.id=ur.user_id
    where (u.auth_id=auth.uid() or u.id=auth.uid())
      and lower(coalesce(ur.role,'')) in ('manager','admin','developer','master')
  );
$$;

create or replace function public.stocko_is_inventory_admin()
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.users u where (u.auth_id=auth.uid() or u.id=auth.uid())
      and lower(coalesce(u.role,'')) in ('admin','developer','master')
  ) or exists (
    select 1 from public.user_roles ur join public.users u on u.id=ur.user_id
    where (u.auth_id=auth.uid() or u.id=auth.uid())
      and lower(coalesce(ur.role,'')) in ('admin','developer','master')
  );
$$;

create or replace function public.close_business_shift(p_branch_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_role text; v_uid uuid; v_old public.business_shifts; v_new public.business_shifts; v_now timestamptz := clock_timestamp(); begin
  select id, role into v_uid, v_role from public.users where auth_id=auth.uid() limit 1;
  if v_uid is null or lower(coalesce(v_role,'')) not in ('developer','master','admin','manager') then
    raise exception 'Only Manager, Admin, Master or Developer can close a shift';
  end if;
  select * into v_old from public.business_shifts where branch_id=p_branch_id and status='open' order by opened_at desc limit 1 for update;
  if v_old.id is null then perform public.ensure_current_business_shift(p_branch_id); select * into v_old from public.business_shifts where branch_id=p_branch_id and status='open' order by opened_at desc limit 1 for update; end if;
  update public.business_shifts set closed_at=v_now,closed_by=v_uid,status='closed' where id=v_old.id returning * into v_old;
  insert into public.business_shifts(branch_id,opened_at,opened_by,status) values(p_branch_id,v_now,v_uid,'open') returning * into v_new;
  return jsonb_build_object('closed_shift',to_jsonb(v_old),'new_shift',to_jsonb(v_new));
end $$;

-- Defense in depth: even if a broad branches RLS policy exists, Master can never mutate branches.
create or replace function public.stocko_block_master_branch_mutation()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_role text;
begin
  select role into v_role from public.users where auth_id=auth.uid() limit 1;
  if lower(coalesce(v_role,'')) = 'master' then
    raise exception 'Master can view and use branches but cannot add, edit, or delete branches';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists trg_stocko_block_master_branch_mutation on public.branches;
create trigger trg_stocko_block_master_branch_mutation
before insert or update or delete on public.branches
for each row execute function public.stocko_block_master_branch_mutation();
