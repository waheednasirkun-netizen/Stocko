-- Stocko Phase 3: manager deactivate + Admin/Developer auditable reversals.
-- Reversal records are retained; original business rows are never silently erased.

create or replace function public.stocko_is_operator()
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.users u
    where (u.auth_id=auth.uid() or u.id=auth.uid())
      and lower(coalesce(u.role,'')) in ('admin','developer')
  ) or exists (
    select 1 from public.user_roles ur join public.users u on u.id=ur.user_id
    where (u.auth_id=auth.uid() or u.id=auth.uid())
      and lower(coalesce(ur.role,'')) in ('admin','developer')
  );
$$;

create or replace function public.stocko_can_deactivate_inventory()
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.users u where (u.auth_id=auth.uid() or u.id=auth.uid())
      and lower(coalesce(u.role,'')) in ('manager','admin','developer')
  ) or exists (
    select 1 from public.user_roles ur join public.users u on u.id=ur.user_id
    where (u.auth_id=auth.uid() or u.id=auth.uid())
      and lower(coalesce(ur.role,'')) in ('manager','admin','developer')
  );
$$;

create or replace function public.admin_set_inventory_active(p_inventory_id uuid, p_active boolean)
returns public.inventory language plpgsql security definer set search_path=public as $$
declare v_item public.inventory;
begin
  if not public.stocko_can_deactivate_inventory() then raise exception 'Manager, Admin or Developer required'; end if;
  -- Managers may deactivate/reactivate; permanent deletion remains Admin/Developer only.
  update public.inventory set active=p_active, updated_at=now() where id=p_inventory_id returning * into v_item;
  if v_item.id is null then raise exception 'Inventory item not found'; end if;
  return v_item;
end $$;


create or replace function public.admin_set_item_template_enabled(p_template_id uuid, p_enabled boolean)
returns public.item_templates language plpgsql security definer set search_path=public as $$
declare v_item public.item_templates;
begin
  if not public.stocko_can_deactivate_inventory() then raise exception 'Manager, Admin or Developer required'; end if;
  update public.item_templates set enabled=p_enabled where id=p_template_id returning * into v_item;
  if v_item.id is null then raise exception 'Item template not found'; end if;
  return v_item;
end $$;

create table if not exists public.reversal_audit (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid,
  entity_type text not null,
  entity_id uuid not null,
  reason text not null,
  reversed_by uuid,
  reversed_by_name text,
  reversal_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(entity_type, entity_id)
);

alter table public.transactions add column if not exists reversed_at timestamptz;
alter table public.transactions add column if not exists reversed_by uuid;
alter table public.transactions add column if not exists reversal_reason text;
alter table public.transactions add column if not exists reverses_transaction_id uuid;
alter table public.ledger_entries add column if not exists reversed_at timestamptz;
alter table public.ledger_entries add column if not exists reversed_by uuid;
alter table public.ledger_entries add column if not exists reversal_reason text;
alter table public.ledger_entries add column if not exists reverses_entry_id uuid;
alter table public.orders add column if not exists reversed_at timestamptz;
alter table public.orders add column if not exists reversed_by uuid;
alter table public.orders add column if not exists reversal_reason text;

create or replace function public.stocko_reverse_stock_transaction(p_transaction_id uuid, p_reason text)
returns uuid language plpgsql security definer set search_path=public as $$
declare t public.transactions; inv public.inventory; new_id uuid; delta numeric; new_type text; actor uuid;
begin
  if not public.stocko_is_operator() then raise exception 'Only Admin or Developer can reverse transactions'; end if;
  if nullif(trim(p_reason),'') is null then raise exception 'Reversal reason is required'; end if;
  select * into t from public.transactions where id=p_transaction_id for update;
  if t.id is null then raise exception 'Transaction not found'; end if;
  if t.reversed_at is not null then raise exception 'Transaction already reversed'; end if;
  if t.reverses_transaction_id is not null then raise exception 'A reversal transaction cannot be reversed again'; end if;
  select id into actor from public.users where auth_id=auth.uid() or id=auth.uid() limit 1;
  select * into inv from public.inventory where branch_id=t.branch_id and lower(trim(name))=lower(trim(t.item_name)) for update;
  if inv.id is null then raise exception 'Inventory item not found'; end if;
  if lower(t.type) in ('stock in','in') then delta := -abs(t.quantity); new_type := 'Stock OUT';
  else delta := abs(t.quantity); new_type := 'Stock IN'; end if;
  if coalesce(inv.quantity,0)+delta < 0 then raise exception 'Cannot reverse: stock would become negative'; end if;
  update public.inventory set quantity=coalesce(quantity,0)+delta, updated_at=now() where id=inv.id;
  insert into public.transactions(branch_id,item_name,type,quantity,unit,source,notes,recorded_by,recorded_by_name,created_at,request_item_id,reverses_transaction_id)
  values(t.branch_id,t.item_name,new_type,abs(t.quantity),t.unit,'Reversal','REVERSAL: '||p_reason,actor,'Admin/Developer reversal',now(),t.request_item_id,t.id)
  returning id into new_id;
  update public.transactions set reversed_at=now(), reversed_by=actor, reversal_reason=p_reason where id=t.id;
  if t.request_item_id is not null and lower(t.type) in ('fulfillment','stock out','out') then
    update public.request_items set fulfilled_qty=greatest(0,coalesce(fulfilled_qty,0)-abs(t.quantity)), updated_at=now(),
      status=case when greatest(0,coalesce(fulfilled_qty,0)-abs(t.quantity))=0 then 'Pending' else 'Partially Fulfilled' end
    where id=t.request_item_id;
  end if;
  insert into public.reversal_audit(branch_id,entity_type,entity_id,reason,reversed_by,reversal_payload)
  values(t.branch_id,'stock_transaction',t.id,p_reason,actor,jsonb_build_object('reversal_transaction_id',new_id));
  return new_id;
end $$;

create or replace function public.stocko_reverse_ledger_entry(p_entry_id uuid, p_reason text)
returns uuid language plpgsql security definer set search_path=public as $$
declare e public.ledger_entries; new_id uuid; actor uuid;
begin
  if not public.stocko_is_operator() then raise exception 'Only Admin or Developer can reverse ledger transactions'; end if;
  if nullif(trim(p_reason),'') is null then raise exception 'Reversal reason is required'; end if;
  select * into e from public.ledger_entries where id=p_entry_id for update;
  if e.id is null then raise exception 'Ledger entry not found'; end if;
  if e.reversed_at is not null or e.reverses_entry_id is not null then raise exception 'Entry already reversed or is a reversal'; end if;
  select id into actor from public.users where auth_id=auth.uid() or id=auth.uid() limit 1;
  insert into public.ledger_entries(customer_id,branch_id,order_id,amount,type,description,created_by,created_by_name,created_at,reverses_entry_id)
  values(e.customer_id,e.branch_id,e.order_id,-e.amount,'reversal','REVERSAL: '||p_reason,actor,'Admin/Developer reversal',now(),e.id)
  returning id into new_id;
  update public.ledger_entries set reversed_at=now(),reversed_by=actor,reversal_reason=p_reason where id=e.id;
  insert into public.reversal_audit(branch_id,entity_type,entity_id,reason,reversed_by,reversal_payload)
  values(e.branch_id,'ledger_entry',e.id,p_reason,actor,jsonb_build_object('reversal_entry_id',new_id));
  return new_id;
end $$;

grant execute on function public.stocko_is_operator() to authenticated;
grant execute on function public.stocko_can_deactivate_inventory() to authenticated;
grant execute on function public.stocko_reverse_stock_transaction(uuid,text) to authenticated;
grant execute on function public.stocko_reverse_ledger_entry(uuid,text) to authenticated;

alter table public.order_payments add column if not exists reversed_at timestamptz;
alter table public.order_payments add column if not exists reversed_by uuid;
alter table public.order_payments add column if not exists reversal_reason text;

create or replace function public.stocko_mark_order_unpaid(p_order_id uuid, p_reason text)
returns public.orders language plpgsql security definer set search_path=public as $$
declare o public.orders; actor uuid; payment_total numeric;
begin
  if not public.stocko_is_operator() then raise exception 'Only Admin or Developer can reverse POS payments'; end if;
  if nullif(trim(p_reason),'') is null then raise exception 'Reversal reason is required'; end if;
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null then raise exception 'Order not found'; end if;
  select id into actor from public.users where auth_id=auth.uid() or id=auth.uid() limit 1;
  select coalesce(sum(amount),0) into payment_total from public.order_payments where order_id=o.id and reversed_at is null;
  if payment_total <= 0 and coalesce(o.paid_amount,0) <= 0 then raise exception 'Order has no payment to reverse'; end if;
  update public.order_payments set reversed_at=now(),reversed_by=actor,reversal_reason=p_reason where order_id=o.id and reversed_at is null;
  -- Reverse only payment ledger rows. The sale/debt entry remains, so the customer becomes outstanding again.
  insert into public.ledger_entries(customer_id,branch_id,order_id,amount,type,description,created_by,created_by_name,created_at)
  select le.customer_id,le.branch_id,le.order_id,-le.amount,'reversal','POS PAYMENT REVERSAL: '||p_reason,actor,'Admin/Developer reversal',now()
  from public.ledger_entries le
  where le.order_id=o.id and le.type='payment' and le.reversed_at is null;
  update public.ledger_entries set reversed_at=now(),reversed_by=actor,reversal_reason=p_reason
  where order_id=o.id and type='payment' and reversed_at is null;
  update public.orders set status='pending',paid_amount=0,due_amount=coalesce(total,0),updated_at=now(),
    reversed_at=now(),reversed_by=actor,reversal_reason=p_reason
  where id=o.id returning * into o;
  insert into public.reversal_audit(branch_id,entity_type,entity_id,reason,reversed_by,reversal_payload)
  values(o.branch_id,'pos_payment',o.id,p_reason,actor,jsonb_build_object('previous_paid_amount',payment_total));
  return o;
end $$;

grant execute on function public.stocko_mark_order_unpaid(uuid,text) to authenticated;

create or replace function public.stocko_reverse_demand(p_request_id uuid, p_reason text)
returns uuid language plpgsql security definer set search_path=public as $$
declare r public.requests; actor uuid;
begin
  if not public.stocko_is_operator() then raise exception 'Only Admin or Developer can reverse demands'; end if;
  if nullif(trim(p_reason),'') is null then raise exception 'Reversal reason is required'; end if;
  select * into r from public.requests where id=p_request_id for update;
  if r.id is null then raise exception 'Demand not found'; end if;
  if exists(select 1 from public.request_items where request_id=r.id and coalesce(fulfilled_qty,0)>0) then
    raise exception 'This demand has fulfillment history. Reverse its fulfillment transaction(s) first.';
  end if;
  select id into actor from public.users where auth_id=auth.uid() or id=auth.uid() limit 1;
  update public.request_items set status='Cancelled',cancelled_qty=greatest(coalesce(cancelled_qty,0),coalesce(qty,0)),updated_at=now() where request_id=r.id;
  update public.requests set status='Rejected',rejected_at=now(),rejection_reason='REVERSED: '||p_reason,updated_at=now() where id=r.id;
  insert into public.reversal_audit(branch_id,entity_type,entity_id,reason,reversed_by)
  values(r.branch_id,'demand',r.id,p_reason,actor);
  return r.id;
end $$;
grant execute on function public.stocko_reverse_demand(uuid,text) to authenticated;
