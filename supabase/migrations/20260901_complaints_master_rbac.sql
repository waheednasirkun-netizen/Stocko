-- Stocko: customer complaints/feedback, QR entry points and Master role.
-- Additive migration: does not alter or delete existing POS/inventory data.

create table if not exists complaint_qr_codes (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references branches(id) on delete cascade,
  qr_kind text not null check (qr_kind in ('customer','table')),
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  customer_id uuid,
  table_number text,
  label text,
  active boolean not null default true,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint complaint_qr_target_check check (
    (qr_kind = 'customer' and customer_id is not null and table_number is null)
    or
    (qr_kind = 'table' and customer_id is null and coalesce(trim(table_number), '') <> '')
  )
);

create index if not exists idx_complaint_qr_branch on complaint_qr_codes(branch_id);
create index if not exists idx_complaint_qr_customer on complaint_qr_codes(customer_id);
create index if not exists idx_complaint_qr_token on complaint_qr_codes(token);

create table if not exists customer_complaints (
  id uuid primary key default gen_random_uuid(),
  complaint_no bigint generated always as identity unique,
  branch_id uuid not null references branches(id) on delete cascade,
  qr_code_id uuid references complaint_qr_codes(id) on delete set null,
  customer_id uuid,
  order_id uuid,
  order_reference text,
  order_type text,
  table_number text,
  customer_name text,
  customer_phone text,
  entry_type text not null default 'complaint' check (entry_type in ('complaint','feedback')),
  category text not null default 'Other',
  rating integer check (rating is null or rating between 1 and 5),
  description text not null,
  status text not null default 'Open' check (status in ('Open','In Progress','Resolved','Closed','Rejected')),
  manager_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references users(id)
);

create index if not exists idx_customer_complaints_branch_date on customer_complaints(branch_id, created_at desc);
create index if not exists idx_customer_complaints_status on customer_complaints(branch_id, status, created_at desc);
create index if not exists idx_customer_complaints_order on customer_complaints(order_id);

create table if not exists complaint_status_history (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null references customer_complaints(id) on delete cascade,
  old_status text,
  new_status text not null,
  changed_by uuid references users(id),
  changed_at timestamptz not null default now(),
  notes text
);

create index if not exists idx_complaint_history_complaint on complaint_status_history(complaint_id, changed_at desc);

-- Keep updated_at/status history consistent for authenticated staff changes.
create or replace function stocko_complaint_status_history()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into complaint_status_history(complaint_id, old_status, new_status, changed_by, notes)
    values (new.id, old.status, new.status, new.resolved_by, new.manager_notes);
  end if;
  new.updated_at := now();
  if new.status in ('Resolved','Closed') and new.resolved_at is null then
    new.resolved_at := now();
  elsif new.status not in ('Resolved','Closed') then
    new.resolved_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_stocko_complaint_update on customer_complaints;
create trigger trg_stocko_complaint_update
before update on customer_complaints
for each row execute function stocko_complaint_status_history();

-- Public QR lookup. Only safe, non-sensitive fields are returned.
create or replace function public.get_complaint_qr(p_token text)
returns table (
  qr_id uuid,
  qr_kind text,
  branch_id uuid,
  branch_name text,
  customer_id uuid,
  customer_name text,
  table_number text,
  label text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select q.id, q.qr_kind, q.branch_id, b.name,
         q.customer_id,
         case when q.qr_kind = 'customer' then c.name else null end,
         q.table_number, q.label
  from complaint_qr_codes q
  join branches b on b.id = q.branch_id
  left join customers c on c.id = q.customer_id
  where q.token = trim(p_token) and q.active = true;
end;
$$;

grant execute on function public.get_complaint_qr(text) to anon, authenticated;

-- Public complaint submission. Delivery requires an order reference; dine-in may omit it.
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
  v_message text;
begin
  select * into q from complaint_qr_codes where token = trim(p_token) and active = true limit 1;
  if q.id is null then raise exception 'Invalid or inactive complaint QR code'; end if;

  select name into b_name from branches where id = q.branch_id;
  if b_name is null then raise exception 'Branch not found'; end if;

  if trim(coalesce(p_description,'')) = '' then raise exception 'Complaint or feedback description is required'; end if;
  if lower(coalesce(p_entry_type,'complaint')) not in ('complaint','feedback') then raise exception 'Invalid entry type'; end if;
  if p_rating is not null and (p_rating < 1 or p_rating > 5) then raise exception 'Rating must be between 1 and 5'; end if;

  v_type := case when lower(q.qr_kind) = 'table' then 'dine-in' else 'delivery' end;
  v_order_ref := nullif(trim(coalesce(p_order_reference,'')), '');

  if v_type = 'delivery' and v_order_ref is null then
    raise exception 'Order number is required for delivery complaints';
  end if;

  if v_order_ref is not null then
    select x.* into o
    from orders x
    where x.branch_id = q.branch_id
      and (
        coalesce(x.invoice_no::text,'') = v_order_ref
        or coalesce(x.reference::text,'') = v_order_ref
        or x.id::text = v_order_ref
      )
    order by x.created_at desc
    limit 1;

    v_order_found := found;
    if not v_order_found then raise exception 'Order number was not found for this branch'; end if;

    if v_type = 'delivery' and lower(replace(replace(coalesce(to_jsonb(o)->>'type',to_jsonb(o)->>'order_type',''),'_','-'),' ','')) not in ('delivery','home-delivery','branch-dispatch','branchdispatch') then
      -- Keep this validation permissive for older Stocko installations whose delivery label differs.
      null;
    end if;

    if v_type = 'dine-in' then
      -- If the live orders table exposes a table_number value, require a match. The table QR remains authoritative.
      if to_jsonb(o) ? 'table_number' and coalesce(to_jsonb(o)->>'table_number','') <> ''
         and coalesce(to_jsonb(o)->>'table_number','') <> coalesce(q.table_number,'') then
        raise exception 'That order is not for this table';
      end if;
    end if;
  end if;

  -- Prevent accidental duplicate open submissions for the same QR/order.
  if v_order_ref is not null then
    select * into v_existing
    from customer_complaints
    where branch_id = q.branch_id
      and qr_code_id = q.id
      and order_reference = v_order_ref
      and status not in ('Resolved','Closed','Rejected')
      and entry_type = lower(coalesce(p_entry_type,'complaint'))
    order by created_at desc limit 1;

    if found then
      return jsonb_build_object(
        'success', false,
        'duplicate', true,
        'complaint_id', v_existing.id,
        'complaint_no', v_existing.complaint_no,
        'status', v_existing.status,
        'branch_name', b_name,
        'message', 'An active complaint already exists for this order.'
      );
    end if;
  end if;

  insert into customer_complaints (
    branch_id, qr_code_id, customer_id, order_id, order_reference, order_type,
    table_number, customer_name, customer_phone, entry_type, category, rating, description
  ) values (
    q.branch_id, q.id, q.customer_id,
    case when v_order_found then o.id else null end,
    v_order_ref,
    v_type,
    q.table_number,
    nullif(trim(p_customer_name), ''),
    nullif(trim(p_customer_phone), ''),
    lower(coalesce(p_entry_type,'complaint')),
    nullif(trim(coalesce(p_category,'Other')), ''),
    p_rating,
    trim(p_description)
  ) returning * into v_complaint;

  return jsonb_build_object(
    'success', true,
    'complaint_id', v_complaint.id,
    'complaint_no', v_complaint.complaint_no,
    'status', v_complaint.status,
    'branch_name', b_name,
    'message', 'Your complaint/feedback has been submitted successfully.'
  );
exception when undefined_table then
  raise exception 'Stocko order/customer tables are not available. Apply the complaint migration after the POS schema is present.';
end;
$$;

grant execute on function public.submit_customer_complaint(text,text,text,text,text,integer,text,text) to anon, authenticated;

-- Authenticated branch/global policies.
alter table complaint_qr_codes enable row level security;
alter table customer_complaints enable row level security;
alter table complaint_status_history enable row level security;

-- Helper: public.users.id may differ from auth.uid() in legacy Stocko installations.
create or replace function public.stocko_current_user()
returns table(id uuid, role text, branch_id uuid)
language sql
security definer
stable
set search_path = public
as $$
  select u.id, u.role, u.branch_id
  from users u
  where u.auth_id = auth.uid() or u.id = auth.uid()
  order by case when u.auth_id = auth.uid() then 0 else 1 end
  limit 1;
$$;

grant execute on function public.stocko_current_user() to authenticated;

drop policy if exists complaint_qr_read on complaint_qr_codes;
create policy complaint_qr_read on complaint_qr_codes for select to authenticated using (
  exists (select 1 from stocko_current_user() me where me.role = 'Master' or me.role = 'Developer' or me.branch_id = complaint_qr_codes.branch_id)
);

drop policy if exists complaint_qr_manage on complaint_qr_codes;
create policy complaint_qr_manage on complaint_qr_codes for all to authenticated using (
  exists (select 1 from stocko_current_user() me where me.role in ('Developer','Admin','Manager') and (me.role = 'Developer' or me.branch_id = complaint_qr_codes.branch_id))
) with check (
  exists (select 1 from stocko_current_user() me where me.role in ('Developer','Admin','Manager') and (me.role = 'Developer' or me.branch_id = complaint_qr_codes.branch_id))
);

drop policy if exists complaints_read on customer_complaints;
create policy complaints_read on customer_complaints for select to authenticated using (
  exists (select 1 from stocko_current_user() me where me.role in ('Master','Developer') or me.branch_id = customer_complaints.branch_id)
);

drop policy if exists complaints_update on customer_complaints;
create policy complaints_update on customer_complaints for update to authenticated using (
  exists (select 1 from stocko_current_user() me where me.role in ('Developer','Admin','Manager') and (me.role = 'Developer' or me.branch_id = customer_complaints.branch_id))
) with check (
  exists (select 1 from stocko_current_user() me where me.role in ('Developer','Admin','Manager') and (me.role = 'Developer' or me.branch_id = customer_complaints.branch_id))
);

drop policy if exists complaint_history_read on complaint_status_history;
create policy complaint_history_read on complaint_status_history for select to authenticated using (
  exists (
    select 1 from customer_complaints c
    join stocko_current_user() me on true
    where c.id = complaint_status_history.complaint_id
      and (me.role in ('Master','Developer') or me.branch_id = c.branch_id)
  )
);

-- Notifications: create the table only if the existing installation doesn't already have it.
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  branch_id uuid references branches(id) on delete cascade,
  type text,
  title text,
  message text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user_created on notifications(user_id, created_at desc);

create or replace function stocko_notify_new_complaint()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications(user_id, branch_id, type, title, message, link, read)
  select u.id, new.branch_id, 'customer_complaint',
         case when new.entry_type = 'feedback' then 'New Customer Feedback' else 'New Customer Complaint' end,
         format('Complaint #%s · %s · %s · %s', new.complaint_no, coalesce(new.order_type, 'Customer'), coalesce(new.order_reference, coalesce('Table ' || new.table_number, 'No order')), new.status),
         '/complaints', false
  from users u
  where u.status = 'Active'
    and (u.role in ('Manager','Admin') and u.branch_id = new.branch_id);
  return new;
end;
$$;

drop trigger if exists trg_stocko_notify_new_complaint on customer_complaints;
create trigger trg_stocko_notify_new_complaint
after insert on customer_complaints
for each row execute function stocko_notify_new_complaint();

-- Master is developer-assigned only. These constraints are also enforced by the Edge Functions below.
create or replace function stocko_protect_master_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare caller_role text;
begin
  select role into caller_role from stocko_current_user() limit 1;
  if new.role = 'Master' and coalesce(caller_role,'') <> 'Developer' then
    raise exception 'Only a Developer can assign the Master role';
  end if;
  if old.role = 'Master' and coalesce(caller_role,'') <> 'Developer' then
    raise exception 'Only a Developer can modify a Master account';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_stocko_protect_master_role on users;
create trigger trg_stocko_protect_master_role
before update on users
for each row execute function stocko_protect_master_role();

-- Prevent non-Developers from assigning Admin as well.
create or replace function stocko_protect_admin_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare caller_role text;
begin
  if auth.role() = 'service_role' then return new; end if;
  select role into caller_role from stocko_current_user() limit 1;
  if new.role = 'Admin' and coalesce(caller_role,'') = 'Manager' then
    raise exception 'Managers cannot assign the Admin role';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_stocko_protect_admin_assignment on users;
create trigger trg_stocko_protect_admin_assignment
before update on users
for each row execute function stocko_protect_admin_assignment();

create unique index if not exists uq_active_table_complaint_qr
  on complaint_qr_codes(branch_id, table_number)
  where qr_kind = 'table' and active = true;

create unique index if not exists uq_active_customer_complaint_qr
  on complaint_qr_codes(branch_id, customer_id)
  where qr_kind = 'customer' and active = true;
