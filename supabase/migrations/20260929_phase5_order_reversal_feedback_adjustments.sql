-- Stocko Phase 5
-- 1) Complete POS order reversal from POS Reports
-- 2) 1-3 star feedback alerts Manager/Admin
-- 3) Payment AND manual balance-adjustment reversal

create or replace function public.stocko_reverse_ledger_entry(p_entry_id uuid, p_reason text)
returns uuid language plpgsql security definer set search_path=public as $$
declare e public.ledger_entries; new_id uuid; actor uuid; reversal_type text;
begin
  if not public.stocko_is_operator() then raise exception 'Only Admin or Developer can reverse ledger transactions'; end if;
  if nullif(trim(p_reason),'') is null then raise exception 'Reversal reason is required'; end if;
  select * into e from public.ledger_entries where id=p_entry_id for update;
  if e.id is null then raise exception 'Ledger entry not found'; end if;
  if e.reversed_at is not null or e.reverses_entry_id is not null then raise exception 'Entry already reversed or is a reversal'; end if;
  if e.type not in ('payment','adjustment') then raise exception 'Only received payments and balance adjustments can be reversed here'; end if;
  select id into actor from public.users where auth_id=auth.uid() or id=auth.uid() limit 1;
  if actor is null then raise exception 'Unable to identify current Stocko user'; end if;
  reversal_type := case when e.type='payment' then 'refund' else 'adjustment' end;
  insert into public.ledger_entries(customer_id,branch_id,order_id,amount,type,description,created_by,created_by_name,created_at,reverses_entry_id)
  values(e.customer_id,e.branch_id,e.order_id,-e.amount,reversal_type,
         case when e.type='payment' then 'PAYMENT REVERSAL: ' else 'ADJUSTMENT REVERSAL: ' end || trim(p_reason),
         actor,'Admin/Developer reversal',now(),e.id)
  returning id into new_id;
  update public.ledger_entries set reversed_at=now(),reversed_by=actor,reversal_reason=trim(p_reason) where id=e.id;
  insert into public.reversal_audit(branch_id,entity_type,entity_id,reason,reversed_by,reversal_payload)
  values(e.branch_id,'ledger_entry',e.id,trim(p_reason),actor,jsonb_build_object('reversal_entry_id',new_id,'original_type',e.type,'reversal_type',reversal_type,'original_amount',e.amount,'reversal_amount',-e.amount));
  return new_id;
end $$;
grant execute on function public.stocko_reverse_ledger_entry(uuid,text) to authenticated;

create or replace function public.stocko_reverse_pos_order(p_order_id uuid, p_reason text)
returns public.orders language plpgsql security definer set search_path=public as $$
declare o public.orders; actor uuid; li record; le record; rid uuid;
begin
  if not public.stocko_is_operator() then raise exception 'Only Admin or Developer can reverse POS orders'; end if;
  if nullif(trim(p_reason),'') is null then raise exception 'Reversal reason is required'; end if;
  select * into o from public.orders where id=p_order_id for update;
  if o.id is null then raise exception 'Order not found'; end if;
  if o.reversed_at is not null or lower(coalesce(o.status,''))='reversed' then raise exception 'Order already reversed'; end if;
  select id into actor from public.users where auth_id=auth.uid() or id=auth.uid() limit 1;
  if actor is null then raise exception 'Unable to identify current Stocko user'; end if;

  -- Return every sold line to stock exactly once.
  for li in select * from public.order_items where order_id=o.id loop
    if li.inventory_id is not null and coalesce(li.quantity,0)>0 then
      update public.inventory set quantity=coalesce(quantity,0)+abs(li.quantity), updated_at=now()
      where id=li.inventory_id and branch_id=o.branch_id;
      if not found then raise exception 'Inventory item % for this order was not found in the order branch', li.inventory_id; end if;
    end if;
  end loop;

  -- Reverse payment records.
  update public.order_payments set reversed_at=now(),reversed_by=actor,reversal_reason=trim(p_reason)
  where order_id=o.id and reversed_at is null;

  -- Neutralize every active order-linked ledger effect using only allowed ledger types.
  for le in select * from public.ledger_entries where order_id=o.id and reversed_at is null and reverses_entry_id is null for update loop
    insert into public.ledger_entries(customer_id,branch_id,order_id,amount,type,description,created_by,created_by_name,created_at,reverses_entry_id)
    values(le.customer_id,le.branch_id,le.order_id,-le.amount,
           case when le.type='payment' then 'refund' else 'adjustment' end,
           'ORDER REVERSAL: '||trim(p_reason),actor,'Admin/Developer reversal',now(),le.id)
    returning id into rid;
    update public.ledger_entries set reversed_at=now(),reversed_by=actor,reversal_reason=trim(p_reason) where id=le.id;
  end loop;

  update public.orders set status='reversed',paid_amount=0,due_amount=0,updated_at=now(),reversed_at=now(),reversed_by=actor,reversal_reason=trim(p_reason)
  where id=o.id returning * into o;

  insert into public.reversal_audit(branch_id,entity_type,entity_id,reason,reversed_by,reversal_payload)
  values(o.branch_id,'pos_order',o.id,trim(p_reason),actor,jsonb_build_object('stock_restored',true,'ledger_neutralized',true,'payments_reversed',true));
  return o;
end $$;
grant execute on function public.stocko_reverse_pos_order(uuid,text) to authenticated;

create or replace function public.stocko_notify_new_complaint()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.notifications(user_id,branch_id,type,title,message,link,read)
  select u.id,new.branch_id,
         case when new.entry_type='feedback' and coalesce(new.rating,5)<=3 then 'customer_low_rating' else 'customer_feedback' end,
         case when new.entry_type='feedback' and coalesce(new.rating,5)<=3 then 'Urgent Customer Feedback' when new.entry_type='feedback' then 'New Customer Feedback' else 'New Customer Complaint' end,
         case when new.rating is not null then format('%s-star feedback · %s',new.rating,left(coalesce(new.description,'Customer feedback'),180)) else left(coalesce(new.description,'New customer complaint'),180) end,
         '/complaints',false
  from public.users u
  where u.branch_id=new.branch_id and lower(coalesce(u.status,'active'))='active'
    and lower(coalesce(u.role,'')) in ('manager','admin');
  return new;
end $$;
