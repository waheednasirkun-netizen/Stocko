-- Stocko Phase 6
-- Reverse a completed/paid POS order back to Pending using the SAME order/invoice.
-- Inventory is intentionally NOT restored: Stocko deducts stock when the pending order is created,
-- so the pending order must continue holding that stock reservation.

create or replace function public.stocko_reverse_pos_order(p_order_id uuid, p_reason text)
returns public.orders
language plpgsql
security definer
set search_path=public
as $$
declare
  o public.orders;
  actor uuid;
  le record;
  rid uuid;
begin
  if not public.stocko_is_operator() then
    raise exception 'Only Admin or Developer can reverse POS orders';
  end if;
  if nullif(trim(p_reason),'') is null then
    raise exception 'Reversal reason is required';
  end if;

  select * into o from public.orders where id=p_order_id for update;
  if o.id is null then raise exception 'Order not found'; end if;
  if lower(coalesce(o.status,'')) in ('pending','unpaid') then
    raise exception 'Order is already pending';
  end if;

  select id into actor
  from public.users
  where auth_id=auth.uid() or id=auth.uid()
  limit 1;
  if actor is null then raise exception 'Unable to identify current Stocko user'; end if;

  -- Reverse all active payment records. They remain in history for audit.
  update public.order_payments
  set reversed_at=now(), reversed_by=actor, reversal_reason=trim(p_reason)
  where order_id=o.id and reversed_at is null;

  -- Neutralize active customer-ledger effects for this order.
  -- sale (+) becomes adjustment (-); payment (-) becomes refund (+).
  for le in
    select * from public.ledger_entries
    where order_id=o.id
      and reversed_at is null
      and reverses_entry_id is null
    for update
  loop
    insert into public.ledger_entries(
      customer_id,branch_id,order_id,amount,type,description,
      created_by,created_by_name,created_at,reverses_entry_id
    ) values(
      le.customer_id,le.branch_id,le.order_id,-le.amount,
      case when le.type='payment' then 'refund' else 'adjustment' end,
      'ORDER RESET TO PENDING: '||trim(p_reason),
      actor,'Admin/Developer reversal',now(),le.id
    ) returning id into rid;

    update public.ledger_entries
    set reversed_at=now(), reversed_by=actor, reversal_reason=trim(p_reason)
    where id=le.id;
  end loop;

  -- IMPORTANT: do not restore inventory here. The order is active again as Pending,
  -- and Stocko already deducted its items when the order was originally created.
  update public.orders
  set status='pending',
      paid_amount=0,
      due_amount=coalesce(total,0),
      completed_by=null,
      completed_by_name=null,
      completed_at=null,
      updated_at=now(),
      reversed_at=null,
      reversed_by=null,
      reversal_reason=null
  where id=o.id
  returning * into o;

  insert into public.reversal_audit(
    branch_id,entity_type,entity_id,reason,reversed_by,reversal_payload
  ) values(
    o.branch_id,'pos_order_reset_to_pending',o.id,trim(p_reason),actor,
    jsonb_build_object(
      'returned_to_pending',true,
      'same_order_id',true,
      'stock_restored',false,
      'ledger_neutralized',true,
      'payments_reversed',true,
      'can_be_paid_again',true
    )
  );

  return o;
end $$;

grant execute on function public.stocko_reverse_pos_order(uuid,text) to authenticated;
