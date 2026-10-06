# Stocko 2026-09-27 Fix

## Required Supabase step
Run this migration in the Supabase SQL Editor before testing assignments:

`supabase/migrations/20260927_fix_assignment_occurrences_and_staff_access.sql`

This replaces `ensure_task_occurrences`, `start_task_occurrence`, and `complete_task_occurrence` with versions that let an assignee generate/complete only their own occurrence while retaining management branch controls.

## Shift
- Opens automatically: 10:00 AM
- Closes automatically: 4:00 AM next calendar day
- 4:00 AM–10:00 AM: POS order creation is blocked.
- Example business shift: 2026-09-27 10:00 → 2026-09-28 04:00.

## Historical visibility
Store Keeper and Kitchen Staff shared operational data is restricted to the current/most-recent business shift. Manager/Admin/Developer retain historical access. POS reports for Store Keeper are also forced to the current shift.

## Roles
- Store Keeper: Dashboard, POS, Inventory, Stock Movement (Stock IN only), Fulfillment, Assignments (personal), Suppliers, Reports, Activity Log, Settings.
- Kitchen Staff: Dashboard, Inventory, Demands, Complaints (view only), Assignments (personal), Activity Log, Settings.
- Manager/Admin: full operational access.
- Developer: existing developer/cross-branch behavior retained.


## Inventory / Item lifecycle controls

Run `supabase/migrations/20260927_inventory_item_lifecycle.sql` in Supabase SQL Editor.

- Inventory now supports Active/Inactive and permanent Delete.
- Item Templates now support Active/Inactive and permanent Delete.
- Only Admin and Developer can deactivate/reactivate/delete; enforcement is server-side RPC as well as UI-side.
- Inactive inventory is excluded from normal operational API loads.
- Inactive templates are excluded from Stock Movement template selection.
- Admin/Developer can see inactive records in management views and reactivate them.
- Deleting an inventory row does not delete transaction/activity history.
