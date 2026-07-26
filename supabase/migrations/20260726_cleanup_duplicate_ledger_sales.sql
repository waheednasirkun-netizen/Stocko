-- Keep the earliest valid sale entry for each branch/order and remove only
-- later duplicate sale rows. Payment, adjustment, and cancellation rows are
-- deliberately outside this cleanup.
with ranked_sales as (
  select
    id,
    row_number() over (
      partition by branch_id, order_id
      order by created_at asc nulls last, id asc
    ) as duplicate_rank
  from public.ledger_entries
  where type = 'sale'
    and branch_id is not null
    and order_id is not null
)
delete from public.ledger_entries as ledger
using ranked_sales
where ledger.id = ranked_sales.id
  and ranked_sales.duplicate_rank > 1;
