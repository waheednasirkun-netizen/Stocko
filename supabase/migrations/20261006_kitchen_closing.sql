-- Kitchen Closing: shift-by-shift internal kitchen stock reconciliation.
-- Formula: Used = Opening + Fulfilled Today - Waste - Remaining.
create table if not exists public.kitchen_closing_items (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  shift_id uuid not null references public.business_shifts(id) on delete cascade,
  item_name text not null,
  unit text not null default 'pcs',
  opening_balance numeric not null default 0 check (opening_balance >= 0),
  waste_qty numeric not null default 0 check (waste_qty >= 0),
  remaining_qty numeric check (remaining_qty is null or remaining_qty >= 0),
  created_by uuid references public.users(id) on delete set null,
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shift_id, item_name)
);

create index if not exists kitchen_closing_branch_shift_idx
  on public.kitchen_closing_items(branch_id, shift_id);
create index if not exists kitchen_closing_branch_item_idx
  on public.kitchen_closing_items(branch_id, lower(item_name), created_at desc);

alter table public.kitchen_closing_items enable row level security;

drop policy if exists "kitchen closing read" on public.kitchen_closing_items;
create policy "kitchen closing read" on public.kitchen_closing_items
for select to authenticated using (
  exists (
    select 1 from public.users u
    where u.auth_id = auth.uid()
      and (
        lower(coalesce(u.role,'')) in ('developer','master')
        or u.branch_id = kitchen_closing_items.branch_id
      )
  )
);

drop policy if exists "kitchen closing insert" on public.kitchen_closing_items;
create policy "kitchen closing insert" on public.kitchen_closing_items
for insert to authenticated with check (
  exists (
    select 1 from public.users u
    where u.auth_id = auth.uid()
      and lower(coalesce(u.role,'')) in ('developer','master','admin','manager','kitchen staff')
      and (
        lower(coalesce(u.role,'')) in ('developer','master')
        or u.branch_id = kitchen_closing_items.branch_id
      )
  )
);

drop policy if exists "kitchen closing update" on public.kitchen_closing_items;
create policy "kitchen closing update" on public.kitchen_closing_items
for update to authenticated using (
  exists (
    select 1 from public.users u
    where u.auth_id = auth.uid()
      and lower(coalesce(u.role,'')) in ('developer','master','admin','manager','kitchen staff')
      and (
        lower(coalesce(u.role,'')) in ('developer','master')
        or u.branch_id = kitchen_closing_items.branch_id
      )
  )
) with check (
  exists (
    select 1 from public.users u
    where u.auth_id = auth.uid()
      and lower(coalesce(u.role,'')) in ('developer','master','admin','manager','kitchen staff')
      and (
        lower(coalesce(u.role,'')) in ('developer','master')
        or u.branch_id = kitchen_closing_items.branch_id
      )
  )
);

grant select, insert, update on public.kitchen_closing_items to authenticated;
