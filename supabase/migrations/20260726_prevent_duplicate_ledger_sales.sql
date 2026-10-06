-- Apply after 20260726_cleanup_duplicate_ledger_sales.sql.
-- This sale-only partial index allows any number of legitimate payment rows.
create unique index if not exists ledger_entries_one_sale_per_branch_order
  on public.ledger_entries (branch_id, order_id)
  where type = 'sale';
