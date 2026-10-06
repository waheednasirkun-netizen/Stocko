-- Stocko: fix delivery complaint QR model.
-- Delivery uses exactly ONE QR per branch; customer identifies the order by entering its order number.
-- Dine-in continues to use one QR per table.

-- Remove old active customer-per-branch QR uniqueness before converting legacy customer QRs.
drop index if exists uq_active_customer_complaint_qr;

-- The original migration used qr_kind='customer'. Convert legacy customer QR records to branch delivery QRs.
-- Keep the oldest QR active per branch and deactivate additional legacy delivery/customer QRs.
do $$
declare
  r record;
begin
  for r in
    select id, branch_id, row_number() over (partition by branch_id order by created_at asc, id asc) as rn
    from complaint_qr_codes
    where qr_kind = 'customer'
  loop
    update complaint_qr_codes
       set qr_kind = 'delivery',
           customer_id = null,
           table_number = null,
           label = coalesce(nullif(trim(label), ''), 'Delivery Complaint QR'),
           active = case when r.rn = 1 then active else false end,
           updated_at = now()
     where id = r.id;
  end loop;
end $$;

-- Replace the old target constraint with the correct table/delivery rules.
alter table complaint_qr_codes drop constraint if exists complaint_qr_target_check;
alter table complaint_qr_codes add constraint complaint_qr_target_check check (
  (qr_kind = 'delivery' and customer_id is null and table_number is null)
  or
  (qr_kind = 'table' and customer_id is null and coalesce(trim(table_number), '') <> '')
);

-- Exactly one ACTIVE delivery QR per branch.
create unique index if not exists uq_active_delivery_complaint_qr
  on complaint_qr_codes(branch_id)
  where qr_kind = 'delivery' and active = true;

-- Keep table QR uniqueness per branch/table.
create unique index if not exists uq_active_table_complaint_qr
  on complaint_qr_codes(branch_id, table_number)
  where qr_kind = 'table' and active = true;

-- Public submission already requires an order number for delivery. Make the QR kind explicit.
create or replace function public.submit_customer_complaint(
  p_token text,
  p_order_reference text default null,
  p_entry_type text default 'complaint',
  p_category text default 'Other',
  p_description text default '',
  p_rating integer default null,
  p_customer_name text default null,
  p_customer_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  q complaint_qr_codes%rowtype;
  b_name text;
  o record;
  v_type text;
  v_order_ref text;
  v_existing customer_complaints%rowtype;
  v_complaint customer_complaints%rowtype;
  v_order_found boolean := false;
begin
  select * into q from complaint_qr_codes where token = trim(p_token) and active = true limit 1;
  if q.id is null then raise exception 'Invalid or inactive complaint QR code'; end if;

  select name into b_name from branches where id = q.branch_id;
  if b_name is null then raise exception 'Branch not found'; end if;
  if trim(coalesce(p_description,'')) = '' then raise exception 'Complaint or feedback description is required'; end if;
  if lower(coalesce(p_entry_type,'complaint')) not in ('complaint','feedback') then raise exception 'Invalid entry type'; end if;
  if p_rating is not null and (p_rating < 1 or p_rating > 5) then raise exception 'Rating must be between 1 and 5'; end if;

  v_type := case when q.qr_kind = 'table' then 'dine-in' else 'delivery' end;
  v_order_ref := nullif(trim(coalesce(p_order_reference,'')), '');

  if v_type = 'delivery' and v_order_ref is null then
    raise exception 'Order number is required for delivery complaints';
  end if;

  if v_order_ref is not null then
    select x.* into o
      from orders x
     where x.branch_id = q.branch_id
       and (coalesce(x.invoice_no::text,'') = v_order_ref
         or coalesce(x.reference::text,'') = v_order_ref
         or x.id::text = v_order_ref)
     order by x.created_at desc
     limit 1;
    v_order_found := found;
    if not v_order_found then raise exception 'Order number was not found for this branch'; end if;

    if v_type = 'dine-in' and to_jsonb(o) ? 'table_number'
       and coalesce(to_jsonb(o)->>'table_number','') <> ''
       and coalesce(to_jsonb(o)->>'table_number','') <> coalesce(q.table_number,'') then
      raise exception 'That order is not for this table';
    end if;
  end if;

  if v_order_ref is not null then
    select * into v_existing
      from customer_complaints
     where branch_id = q.branch_id
       and order_reference = v_order_ref
       and status not in ('Resolved','Closed','Rejected')
       and entry_type = lower(coalesce(p_entry_type,'complaint'))
     order by created_at desc limit 1;
    if found then
      return jsonb_build_object('success',false,'duplicate',true,'complaint_id',v_existing.id,'complaint_no',v_existing.complaint_no,'status',v_existing.status,'branch_name',b_name,'message','An active complaint already exists for this order.');
    end if;
  end if;

  insert into customer_complaints (branch_id, qr_code_id, customer_id, order_id, order_reference, order_type, table_number, customer_name, customer_phone, entry_type, category, rating, description, status)
  values (q.branch_id, q.id, null, case when v_order_found then o.id else null end, v_order_ref, v_type, case when q.qr_kind = 'table' then q.table_number else null end, nullif(trim(p_customer_name),''), nullif(trim(p_customer_phone),''), lower(coalesce(p_entry_type,'complaint')), coalesce(nullif(trim(p_category),''),'Other'), p_rating, trim(p_description), 'Open')
  returning * into v_complaint;

  insert into complaint_status_history(complaint_id, old_status, new_status, changed_by, notes) values (v_complaint.id, null, 'Open', null, null);

  return jsonb_build_object('success',true,'complaint_id',v_complaint.id,'complaint_no',v_complaint.complaint_no,'status',v_complaint.status,'branch_id',q.branch_id,'branch_name',b_name,'order_reference',v_complaint.order_reference,'order_type',v_complaint.order_type,'table_number',v_complaint.table_number,'message','Your complaint/feedback has been submitted successfully.');
end;
$$;

grant execute on function public.submit_customer_complaint(text,text,text,text,text,integer,text,text) to anon, authenticated;
