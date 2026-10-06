-- Stocko Phase 7
-- Allow an order that was reset to Pending to create a fresh active sale ledger row
-- when it is paid again, while preserving the old reversed sale for audit history.

DROP INDEX IF EXISTS public.ledger_entries_one_sale_per_branch_order;

CREATE UNIQUE INDEX ledger_entries_one_active_sale_per_branch_order
  ON public.ledger_entries (branch_id, order_id)
  WHERE type = 'sale'
    AND reversed_at IS NULL
    AND reverses_entry_id IS NULL;
