-- Customer outstanding is intentionally NOT reset at shift close.
-- ledger_entries remains immutable history; current-shift collected cash is derived
-- from payment/credit rows whose created_at is within the business shift window.
create index if not exists ledger_entries_branch_created_amount_idx
  on public.ledger_entries(branch_id, created_at desc, amount);
