-- Stocko: safe inventory/template lifecycle controls
-- Only Admin and Developer may deactivate/reactivate or delete.

alter table public.inventory
  add column if not exists active boolean not null default true;

alter table public.item_templates
  add column if not exists enabled boolean not null default true;

create or replace function public.stocko_is_inventory_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users u
    where (u.auth_id = auth.uid() or u.id = auth.uid())
      and lower(coalesce(u.role, '')) in ('admin', 'developer')
  ) or exists (
    select 1
    from public.user_roles ur
    join public.users u on u.id = ur.user_id
    where (u.auth_id = auth.uid() or u.id = auth.uid())
      and lower(coalesce(ur.role, '')) in ('admin', 'developer')
  );
$$;

create or replace function public.admin_set_inventory_active(p_inventory_id uuid, p_active boolean)
returns public.inventory
language plpgsql
security definer
set search_path = public
as $$
declare v_item public.inventory;
begin
  if not public.stocko_is_inventory_admin() then
    raise exception 'Only Admin or Developer can change inventory item status';
  end if;
  update public.inventory set active = p_active, updated_at = now()
  where id = p_inventory_id returning * into v_item;
  if v_item.id is null then raise exception 'Inventory item not found'; end if;
  return v_item;
end; $$;

create or replace function public.admin_delete_inventory_item(p_inventory_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not public.stocko_is_inventory_admin() then
    raise exception 'Only Admin or Developer can delete inventory items';
  end if;
  delete from public.inventory where id = p_inventory_id returning id into v_id;
  if v_id is null then raise exception 'Inventory item not found'; end if;
  return v_id;
end; $$;

create or replace function public.admin_set_item_template_enabled(p_template_id uuid, p_enabled boolean)
returns public.item_templates
language plpgsql
security definer
set search_path = public
as $$
declare v_item public.item_templates;
begin
  if not public.stocko_is_inventory_admin() then
    raise exception 'Only Admin or Developer can change item status';
  end if;
  update public.item_templates set enabled = p_enabled
  where id = p_template_id returning * into v_item;
  if v_item.id is null then raise exception 'Item template not found'; end if;
  return v_item;
end; $$;

create or replace function public.admin_delete_item_template(p_template_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if not public.stocko_is_inventory_admin() then
    raise exception 'Only Admin or Developer can delete item templates';
  end if;
  delete from public.item_templates where id = p_template_id returning id into v_id;
  if v_id is null then raise exception 'Item template not found'; end if;
  return v_id;
end; $$;

grant execute on function public.admin_set_inventory_active(uuid, boolean) to authenticated;
grant execute on function public.admin_delete_inventory_item(uuid) to authenticated;
grant execute on function public.admin_set_item_template_enabled(uuid, boolean) to authenticated;
grant execute on function public.admin_delete_item_template(uuid) to authenticated;
