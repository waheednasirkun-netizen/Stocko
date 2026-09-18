-- Independent lifecycle for every product inside a multi-item request.
-- Safe to run after the existing requests/request_items tables exist.

alter table public.request_items
  add column if not exists status text not null default 'Pending',
  add column if not exists rejection_reason text,
  add column if not exists rejected_by uuid,
  add column if not exists rejected_by_name text,
  add column if not exists rejected_at timestamptz,
  add column if not exists fulfilled_by uuid,
  add column if not exists fulfilled_by_name text,
  add column if not exists fulfilled_at timestamptz,
  add column if not exists updated_at timestamptz default now();

-- Backfill legacy rows from fulfilled_qty. Do not use the parent request status
-- as the lifecycle of each child item.
update public.request_items
set status = case
  when coalesce(fulfilled_qty, 0) >= coalesce(qty, 0) and coalesce(qty, 0) > 0
    then 'Fulfilled'
  when coalesce(fulfilled_qty, 0) > 0
    then 'Partially Fulfilled'
  else 'Pending'
end
where status is null or status = 'Pending';

create index if not exists idx_request_items_request_id
  on public.request_items(request_id);

create index if not exists idx_request_items_status
  on public.request_items(status);

-- Keep status values explicit while allowing legacy workflows to retain
-- Approved/Completed/Cancelled terminology if already used elsewhere.
alter table public.request_items
  drop constraint if exists request_items_status_check;

alter table public.request_items
  add constraint request_items_status_check
  check (status in (
    'Pending',
    'Approved',
    'Partially Fulfilled',
    'Fulfilled',
    'Completed',
    'Rejected',
    'Cancelled'
  ));

-- Link inventory transactions to the exact request item when available.
-- Existing reference_id remains untouched for backward compatibility.
alter table public.transactions
  add column if not exists request_item_id uuid;

create index if not exists idx_transactions_request_item_id
  on public.transactions(request_item_id);

comment on column public.request_items.status is
  'Independent lifecycle of this product item; parent requests.status is only an aggregate.';
comment on column public.transactions.request_item_id is
  'Exact request_items row that caused this inventory transaction.';
