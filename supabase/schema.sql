-- Restaurant Inventory Management System — Supabase Schema
-- Run this in the Supabase SQL Editor for a fresh project setup.

-- ─── Branches (multi-branch support) ───────────────────────────────────────
create table if not exists branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  created_at timestamptz default now()
);

-- ─── Users ───────────────────────────────────────────────────────────────────
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique not null,
  password text not null,
  role text not null default 'Store Keeper',
  status text not null default 'Active',
  phone text,
  branch_id uuid references branches(id),
  created_at timestamptz default now()
);

-- ─── User ↔ Branch mapping (optional, for multi-branch access) ───────────────
create table if not exists user_branch_mappings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  branch_id uuid references branches(id) on delete cascade,
  created_at timestamptz default now(),
  unique(user_id, branch_id)
);

-- ─── Transactions (source of truth — inventory is derived from this) ─────────
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id),
  item_name text not null,
  type text not null,           -- 'Stock IN', 'Stock OUT', 'Wastage', 'Fulfillment'
  quantity numeric not null,
  unit text,
  price_per_unit numeric default 0,
  total_amount numeric default 0,
  source text,
  category text,
  notes text,
  recorded_by uuid references users(id),
  recorded_by_name text,
  created_at timestamptz default now()
);

-- ─── Demands ─────────────────────────────────────────────────────────────────
create table if not exists demands (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id),
  item_name text not null,
  name text,
  category text,
  unit text,
  quantity numeric not null,
  qty numeric,
  priority text default 'Medium',
  department text,
  notes text,
  status text default 'Pending',
  created_by uuid references users(id),
  created_by_name text,
  approved_by uuid references users(id),
  approved_at timestamptz,
  rejected_by uuid references users(id),
  rejection_reason text,
  fulfilled_by uuid references users(id),
  fulfilled_at timestamptz,
  fulfilled_qty numeric,
  txn_id uuid references transactions(id),
  created_at timestamptz default now()
);

-- ─── Item Templates ──────────────────────────────────────────────────────────
create table if not exists item_templates (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id),
  name text not null,
  category text,
  unit text default 'pcs',
  default_price numeric default 0,
  low_stock_threshold numeric default 0,
  enabled boolean default true,
  created_by uuid references users(id),
  created_at timestamptz default now()
);

-- ─── Suppliers ───────────────────────────────────────────────────────────────
create table if not exists suppliers (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id),
  name text not null,
  phone text,
  address text,
  status text default 'Active',
  notes text,
  created_at timestamptz default now()
);

-- ─── Financial Transactions ──────────────────────────────────────────────────
create table if not exists financial_transactions (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id),
  type text default 'purchase',
  item_name text,
  category text,
  quantity numeric,
  unit text,
  price_per_unit numeric default 0,
  total_amount numeric default 0,
  payment_status text default 'unpaid',
  supplier text,
  department text,
  recorded_by uuid references users(id),
  reference_id uuid,
  created_at timestamptz default now()
);

-- ─── Procurement Requests ────────────────────────────────────────────────────
create table if not exists procurement_requests (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id),
  item_name text not null,
  quantity numeric,
  unit text,
  priority text default 'Medium',
  status text default 'Open',
  notes text,
  created_by uuid references users(id),
  updated_by uuid references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz
);

-- ─── Purchase Orders ─────────────────────────────────────────────────────────
create table if not exists purchase_orders (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id),
  supplier text,
  total_amount numeric default 0,
  status text default 'Ordered',
  notes text,
  created_by uuid references users(id),
  updated_by uuid references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz
);

create table if not exists purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid references purchase_orders(id) on delete cascade,
  item_name text,
  quantity numeric,
  unit text,
  price_per_unit numeric,
  total_amount numeric,
  created_at timestamptz default now()
);

-- ─── Activity Logs ───────────────────────────────────────────────────────────
create table if not exists activity_logs (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references branches(id),
  user_id uuid references users(id),
  user_name text,
  action text,
  details text,
  created_at timestamptz default now()
);

-- ─── Development: disable RLS (enable + add policies before production) ──────
-- alter table transactions disable row level security;
-- alter table demands disable row level security;
-- alter table item_templates disable row level security;
-- alter table suppliers disable row level security;
-- alter table users disable row level security;
