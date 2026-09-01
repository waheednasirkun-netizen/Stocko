# Stocko Inventory Source-of-Truth Audit

**Audit date:** 2026-07-21  
**Repository state audited:** branch `main`, commit `fac97d0` (`Reorder sidebar: Dashboard first, POS second`)  
**Scope:** static repository analysis only; no production Supabase access was available  
**Change policy:** this report is the only file created; no source, schema, migration, environment, or runtime change was made

## 1. Executive Summary

Stocko has **conflicting sources of truth (model C)**.

In day-to-day UI behavior, `inventory.quantity` is the operational current balance. Inventory, POS, fulfillment, Dashboard, Reports, low-stock logic, and stock validation all read that field. However, manual stock movement also writes a separate `transactions` history table, the checked-in schema calls `transactions` the source of truth, and `src/lib/computeInventory.js` can derive balances from transactions. That derivation utility is apparently unused. POS creates no stock transaction, and the active fulfillment path attempts a differently shaped transaction after changing `inventory.quantity`.

The result is not a dual-write model with reconciliation; it is several independent browser-side write paths that can diverge.

The three largest risks are:

1. **POS can create an order and deduct some or all inventory without any stock movement history.** Its order, item, and per-item inventory writes are independent, and inventory-update errors are not inspected (`src/components/pos/POS.jsx:404-473`).
2. **Active fulfillment updates request state before stock, then logs an incompatible, branchless `transactions` row on a best-effort basis.** A failure can leave request, balance, and history disagreeing (`src/pages/FulfillmentCenter.jsx:203-303`).
3. **Manual stock movement inserts history before updating balance using a read-modify-write sequence.** A second-call failure leaves history without a balance change; concurrent users can overwrite one another (`src/lib/api.js:580-802`).

No stock-changing operation found uses a SQL transaction, Supabase RPC, database function, compare-and-swap update, or idempotency key. No tracked migrations exist. The live database, deployed functions, triggers, constraints, grants, RLS policies, and actual production schema could not be verified from this repository.

## 2. Current Inventory Architecture

### Tables and models observed

| Model | Repository evidence | Actual role in application |
|---|---|---|
| `inventory` | Used throughout code but absent from `supabase/schema.sql` | Operational current balance, item metadata, cost, selling price, threshold variants |
| `transactions` | Declared at `supabase/schema.sql:34-50`; read/written in `src/lib/api.js:570-802` | Partial movement history; complete for successful manual movements, absent for POS, unreliable for active fulfillment |
| `orders`, `order_items`, `order_payments` | Used by POS code; absent from checked-in schema | Sales/order records; not a complete stock ledger |
| `requests`, `request_items` | Used by active Demands/Fulfillment; absent from checked-in schema | Current demand workflow |
| `demands` | Declared at `supabase/schema.sql:53-77`; used only by apparently unused `demandsApi` | Older, parallel demand model |
| `purchase_orders`, `purchase_order_items` | Declared at `supabase/schema.sql:141-163` | Procurement status and line items; receiving does not change stock |
| `activity_logs` | Declared at `supabase/schema.sql:166-174` | Best-effort audit text, not a stock ledger |
| `ledger`, `ledger_entries`, `customer_transactions` | Different names used in different code paths; none declared in schema | Customer-money records, not stock; evidence of parallel POS generations |
| `inventory_movements` | No use and no schema declaration found | Not implemented |

### Main components and data flow

```text
AppContext branch load
  -> inventoryApi.getAll(branch) -> inventory rows -> current balance UI
  -> transactionsApi.getAll(branch) -> movement/history UI

Manual Stock Movement
  -> INSERT transactions
  -> UPDATE/INSERT inventory.quantity
  -> INSERT activity_logs (best effort)

Active POS
  -> INSERT orders
  -> INSERT order_items
  -> UPDATE inventory.quantity once per cart line
  -> no transactions row; no activity log

Active Fulfillment
  -> UPDATE request_items
  -> UPDATE requests
  -> UPDATE inventory.quantity
  -> INSERT incompatible transactions row (best effort)
```

### Branch handling

- AppContext resolves a branch from `currentBranch.id`, falling back to the user's branch (`src/context/AppContext.jsx:254-257`).
- Normal inventory and transaction reads filter by `branch_id` (`src/lib/api.js:570-577`, `991-998`).
- Active POS loads inventory/orders/customers with a branch filter (`src/components/pos/POS.jsx:193-251`), but quantity updates filter only by inventory `id` (`:456-459`).
- Active fulfillment receives inventory from branch-scoped AppContext state, but its inventory update filters only by `id`, and its attempted history insert has no `branch_id` (`src/pages/FulfillmentCenter.jsx:255-291`).
- Manual stock API initially scopes the item lookup by branch, but the final update filters only by row `id` (`src/lib/api.js:601-606`, `667-675`, `727-732`, `779-785`).
- Client-side filtering is not a database security boundary. The checked-in RLS file defines policies only for `users` (`supabase/rls_policies.sql:1-19`).

### Realtime handling

AppContext subscribes to branch-filtered `inventory`, `transactions`, and `requests` changes (`src/context/AppContext.jsx:399-440`). Inventory events trigger a full branch reload, while transaction inserts are prepended directly. Stock Movement also adds an optimistic transaction and later replaces it (`src/pages/StockMovement.jsx:402-465`), and AppContext's legacy stock handlers prepend returned transactions (`src/context/AppContext.jsx:576-650`). There is no transaction-ID deduplication, so the same transaction can appear twice in client state depending on event timing.

FulfillmentCenter additionally subscribes to all `requests` changes without a branch filter and calls `fetchRequests()` without the required branch argument (`src/pages/FulfillmentCenter.jsx:57-75`; `src/context/AppContext.jsx:266-267`). The branch-scoped AppContext subscription is the one that actually refreshes requests.

## 3. Stock Read Map

The 22 rows below are the important, distinct UI/service read paths found. Rows marked apparently unused are not reachable from the current `App.jsx` route/import graph found by repository search.

| # | Workflow/Page | File | Function | Table/Source | Branch Filter | Notes |
|---:|---|---|---|---|---|---|
| 1 | Shared current stock load | `src/context/AppContext.jsx:259-264` | `fetchInventory` | `inventoryApi.getAll` -> `inventory` | Yes | Populates context current balances |
| 2 | Shared branch load/history | `src/context/AppContext.jsx:316-359` | `loadBranchData` | `inventory` and `transactions` independently | Yes | Does not compare or reconcile the two |
| 3 | Inventory page | `src/pages/Inventory.jsx:347-399` | `loadItems`, `transactionMap` | `inventory.quantity`; `transactions` for last movement/history | Yes | Balance comes from inventory, not recomputation |
| 4 | Inventory status/export | `src/pages/Inventory.jsx:428-481` | filtered items and stats | Context/local inventory | Inherited | Uses `min_threshold` primarily |
| 5 | Manual movement validation | `src/pages/StockMovement.jsx:260-340` | `validate` and item selection | Context `inventory.quantity` | Inherited | Prevents insufficient stock only against client snapshot |
| 6 | Demand item suggestions | `src/pages/Demands.jsx:20-24` | `getSuggestions` | Context inventory | Inherited | Reads item identity, not a reservation |
| 7 | Fulfillment availability | `src/pages/FulfillmentCenter.jsx:147-155` | `getInvItem`, `getStockStatus` | Context `inventory.quantity` | Inherited | Exact case-insensitive name match |
| 8 | Active POS catalogue | `src/components/pos/POS.jsx:193-218` | `loadInventory` | `inventory` | Yes | POS price and availability come from inventory rows |
| 9 | Dashboard balances | `src/pages/Dashboard.jsx:236-238,269-319` | `branchInventory`, KPI memos | Context `inventory.quantity` | Yes, client-side | Item count, quantity, low/out stock |
| 10 | Dashboard movement KPIs | `src/pages/Dashboard.jsx:242-243,275-335` | `branchTransactions`, KPI/chart memos | Context transactions | Yes, client-side | Omits `Fulfillment` and active fulfillment's `OUT` from several outflow calculations |
| 11 | Reports inventory summary | `src/pages/Reports.jsx:150-151,317-331` | inventory report data | Context `inventory.quantity` | Inherited | Current balance report |
| 12 | Reports movement history | `src/pages/Reports.jsx:230-250` | `filteredTransactions`, totals | Context transactions | Inherited | Includes only `Stock IN`, `Stock OUT`, `Wastage` |
| 13 | Shared low-stock/value stats | `src/context/AppContext.jsx:1101-1132` | `stats` memo | Context inventory | Inherited | Quantity/value/low stock trust inventory |
| 14 | Shared flow stats | `src/context/AppContext.jsx:1112-1118` | `stats` memo | Context transactions | Inherited | Includes `Fulfillment`, unlike Dashboard/Reports |
| 15 | Manual Stock IN pre-read | `src/lib/api.js:580-630` | `transactionsApi.stockIn` | `inventory` + `item_templates` | Yes | Reads old quantity before writing absolute new value |
| 16 | Manual Stock OUT pre-read | `src/lib/api.js:711-749` | `transactionsApi.stockOut` | `inventory` | Yes | Client-side sufficiency check against stale-able value |
| 17 | Transaction-derived balance utility | `src/lib/computeInventory.js:1-69` | `computeInventory` | `transactions` + templates | Caller-dependent | **Apparently unused**; repository search found no import/call |
| 18 | Legacy POS inventory read | `src/lib/pos.js:53-55` | `posApi.getInventory` | `inventoryApi.getAll` | Yes | **Apparently unused by active POS** |
| 19 | Legacy POS placement pre-read | `src/lib/pos.js:108-149` | `posApi.placeOrder` | `inventory` by row ID | No explicit branch in query | **Apparently unused** |
| 20 | Legacy POS cancellation pre-read | `src/lib/pos.js:219-257` | `posApi.cancelOrder` | `order_items`, `inventory` | No explicit branch in queries | **Apparently unused** |
| 21 | Extracted Product List | `src/components/pos/ProductList.jsx:29-63` | loader/cart availability | API inventory search | User branch passed | **Apparently unused**; active POS does not render this component |
| 22 | Duplicate Requests page | `src/pages/Requests.jsx:22-26` | suggestions | Context inventory | Inherited | **Apparently unused**; `App.jsx` routes Demands to `Demands.jsx` |

## 4. Stock Write Map

There are **14 stock-changing entry paths** below. Purchase receiving is included as a fifteenth control row because it is expected to change stock but does not. None is atomic at the database level.

| # | Workflow | File | Function | Database Calls | Updates Current Quantity? | Creates History? | Atomic? | Risk |
|---:|---|---|---|---|---|---|---|---|
| 1 | Manual Stock IN | `src/pages/StockMovement.jsx:384-468` -> `src/lib/api.js:580-708` | `handleSubmit` -> `stockIn` | read inventory/template; insert transaction; update/insert inventory; insert activity | Yes | Yes, before balance | No | Critical |
| 2 | Manual Stock OUT | same entry -> `src/lib/api.js:711-802` | `handleSubmit` -> `stockOut` | read inventory; insert transaction; update inventory; insert activity | Yes | Yes, before balance | No | Critical |
| 3 | Wastage | `src/pages/StockMovement.jsx:11-24,443-452` | `handleSubmit` -> `stockOut(type='Wastage')` | Same as Stock OUT | Yes | Yes | No | Critical |
| 4 | Manual Fulfillment movement | `src/pages/StockMovement.jsx:11-24,443-452` | `handleSubmit` -> `stockOut(type='Fulfillment')` | Same as Stock OUT | Yes | Yes | No | High; separate from request workflow |
| 5 | Active full demand dispatch | `src/pages/FulfillmentCenter.jsx:169-182,203-303` | `handleDispatchFull` -> `executeDispatch` | update request item; update request; update inventory; insert transaction | Yes | Attempted after balance, incompatible/best effort | No | Critical |
| 6 | Active partial dispatch | `src/pages/FulfillmentCenter.jsx:185-199,203-303` | `handlePartialDispatch` -> `executeDispatch` | Same sequence as full | Yes | Attempted | No | Critical |
| 7 | Legacy full fulfillment | `src/context/AppContext.jsx:761-820` | `fulfillRequest` | loop: stockOut dual-write then request-item update; request update; notification/activity | Yes | Yes via `stockOut` | No | High; apparently unused by active page |
| 8 | Legacy partial fulfillment | `src/context/AppContext.jsx:822-890` | `partialFulfillRequest` | loop: stockOut dual-write then request-item update; request update; notification/activity | Yes | Yes via `stockOut` | No | High; apparently unused by active page |
| 9 | Active POS placement | `src/components/pos/POS.jsx:404-473` | `placeOrder` | insert order; insert order items; loop update inventory | Yes | No stock transaction/activity | No | Critical |
| 10 | Legacy POS placement | `src/lib/pos.js:108-162` | `posApi.placeOrder` | insert order; insert items; loop read/update inventory; activity | Yes | Activity only, no stock movement | No | Critical if activated; apparently unused |
| 11 | Legacy POS cancellation | `src/lib/pos.js:219-279` | `posApi.cancelOrder` | update order; read items; loop read/update inventory; optional ledger/activity | Yes, restores | No stock movement | No | High if activated; apparently unused |
| 12 | Direct inventory creation | `src/lib/api.js:1008-1051` | `inventoryApi.create` | duplicate/template reads; insert inventory; activity | Yes, accepts initial quantity | No transaction | No | High if called; apparently unused |
| 13 | Direct inventory update | `src/lib/api.js:1054-1071` | `inventoryApi.update` | update arbitrary safe fields; activity | Potentially; `quantity` is not excluded | No transaction | No | High if called; apparently unused |
| 14 | Direct inventory deletion | `src/lib/api.js:1074-1085` | `inventoryApi.remove` | delete inventory; activity | Deletes balance row | No transaction | No | High if called; apparently unused |
| — | Purchase order “Received” | `src/pages/PurchaseOrders.jsx:7-36`; `src/context/AppContext.jsx:1082-1086`; `src/lib/api.js:932-939` | `updatePOStatus` | update PO status only | **No** | No | N/A | High functional gap |

## 5. Workflow Traces

### 5.1 Manual Stock IN

1. User chooses Stock IN in `StockMovement` (`src/pages/StockMovement.jsx:11-18`).
2. `handleSubmit` validates and immediately applies optimistic inventory and transaction state (`:384-424`).
3. It calls `transactionsApi.stockIn` (`:430-441`).
4. API reads current inventory and optionally a template (`src/lib/api.js:595-630`).
5. API inserts `transactions` first (`:634-658`).
6. API computes `existing.quantity + quantity`, then updates or inserts `inventory` (`:660-698`).
7. API writes a best-effort activity log (`:700-706`; logger swallows errors at `:62-78`).

**Failure behavior:** transaction failure stops everything; inventory failure leaves a committed history row with no matching balance update; activity failure is ignored. Two users can read the same old quantity and both write absolute totals, losing one receipt. Branch ID is present on the read, history, and new-row insert; final updates are by row ID only.

### 5.2 Manual Stock OUT

1. `StockMovement.handleSubmit` validates against context inventory and applies optimistic deductions (`src/pages/StockMovement.jsx:384-424`).
2. It calls `transactionsApi.stockOut` (`:443-452`). Wastage and manual Fulfillment use the same path with a different `type`.
3. API reads the inventory row by branch/name and checks quantity (`src/lib/api.js:726-749`).
4. API inserts `transactions` (`:751-775`).
5. API writes the absolute result `currentQty - quantity` to inventory (`:777-790`).
6. API logs activity (`:794-800`).

**Failure behavior:** history can commit without deduction; activity can be missing. Concurrent users can both pass the sufficiency check and overwrite each other's result. Stock can be oversold in business terms even if the stored number is nonnegative.

### 5.3 Wastage

Wastage is not a separate service; it is manual Stock OUT with `type='Wastage'` (`src/pages/StockMovement.jsx:11-24,443-452`). It has the same non-atomic and concurrency failure modes. Reports include it as outflow.

### 5.4 Demand approval

`AppContext.approveRequest` updates only request status/approval metadata (`src/context/AppContext.jsx:717-737`); it does not reserve or change stock. Repository search found no active page calling it. The active Fulfillment Center includes `Pending` as dispatchable along with `Approved` (`src/pages/FulfillmentCenter.jsx:83-84,128-129`), so approval is not enforced by the live UI path.

### 5.5 Demand fulfillment (active full dispatch)

1. `handleDispatchFull` calculates `min(requested, available)` from client inventory (`src/pages/FulfillmentCenter.jsx:169-182`). It does not subtract an already-fulfilled quantity from `requested`, so a retry/full action on a partially fulfilled line can request too much.
2. `executeDispatch` calculates fulfillment state from the snapshot (`:203-226`).
3. It updates `request_items.fulfilled_qty` first (`:228-239`).
4. It updates `requests.status` (`:241-253`).
5. It computes `Math.max(0, inv.quantity - qty)` and updates inventory by ID (`:255-266`).
6. It attempts a `transactions` insert with type `OUT`, no branch ID, and columns absent from checked-in transaction schema (`:279-295`). The error is logged but does not fail the dispatch.
7. It reports success (`:298-303`). Its explicit `fetchRequests()` call has no branch argument and is a no-op in AppContext, although AppContext realtime may refresh later.

**Failure behavior:** each earlier step remains committed if a later one fails. Inventory can change without usable history. Request metadata can advance without stock changing. Concurrent dispatches use stale absolute balances and stale fulfilled quantities. `processingRef` protects only one mounted browser instance.

### 5.6 Partial fulfillment

The active partial path performs a local `qty <= available` check and calls the same `executeDispatch` (`src/pages/FulfillmentCenter.jsx:185-199`). It therefore has the same ordering, schema, atomicity, race, and retry risks. Concurrent partial dispatches can overwrite `fulfilled_qty` and inventory totals.

An apparently unused second implementation exists in AppContext (`src/context/AppContext.jsx:822-890`). It loops `stockOut` calls, then increments request items from a stale request snapshot, then updates request status. A failure after one item leaves a partial stock deduction. Retrying can deduct an already processed item again. The full version (`:761-820`) always uses each item's full requested quantity, not remaining quantity.

### 5.7 POS order placement (active)

1. `App.jsx` routes `pos` to `src/components/pos/POS.jsx` (`src/App.jsx:23,29-32`).
2. `POS.placeOrder` inserts an `orders` row (`src/components/pos/POS.jsx:404-433`).
3. It inserts all `order_items` (`:435-450`).
4. For each cart item, it reads the already loaded client product and writes `Math.max(0, product.quantity - item.quantity)` to inventory by ID (`:452-461`).
5. It does not capture or test inventory update errors, does not create a stock transaction, does not create an activity log, and then shows success/reloads (`:463-473`).

**Failure behavior:** an order can exist without items; an order with items can have zero, partial, or lost deductions; an inventory failure can still show success; concurrent sales can overwrite each other; `Math.max(0)` hides an insufficient-stock condition. Money/order history and stock history can disagree.

### 5.8 POS order completion

The active POS has no completion handler. `showPaymentModal` is declared but repository search found no setter use beyond declaration (`src/components/pos/POS.jsx:189`). `placeOrder` leaves orders `PENDING` (`:421`).

`posApi.completeOrder` exists in `src/lib/pos.js:165-216` but is apparently unused by active POS. It independently updates the order, inserts payment, inserts `ledger`, and logs activity. Payment/ledger failures are warnings after the order is already completed, so it is not atomic.

### 5.9 POS payment

There is no active payment execution path in `POS.jsx`. The extracted `CheckoutModal.jsx` collects values but is not rendered by active POS. Apparently unused `posApi.processPayment` updates the order, then calls `order_payments`, then `ledger`, then activity (`src/lib/pos.js:282-333`). It references undefined `_now()` at line 306, which would throw after the order update and before ledger/activity. Customer Ledger uses `ledger_entries`, not `ledger` (`src/pages/CustomerLedger.jsx:99-107,128-136`).

### 5.10 POS order editing

No active or legacy stock-aware order-edit handler was found. Existing order rows are displayed by active POS, but no edit sequence reverses the old quantities and applies new quantities. Behavior is therefore unsupported/unverifiable, not safely implemented.

### 5.11 POS order cancellation

No active cancellation UI path was found. Apparently unused `posApi.cancelOrder`:

1. Unconditionally updates the order to cancelled by ID (`src/lib/pos.js:219-235`).
2. Reads all order items (`:237-242`).
3. Reads and restores each inventory quantity with read-modify-write (`:243-257`).
4. Optionally inserts `ledger` and activity (`:259-277`).

There is no status precondition, cancellation idempotency key, transaction movement, or rollback. Calling it twice restores inventory twice. Concurrent restoration can lose updates.

### 5.12 Purchase order receiving

The `Mark Received` button calls `updatePOStatus(po.id, 'Received')` (`src/pages/PurchaseOrders.jsx:7-36`). AppContext delegates to `purchaseOrdersApi.updateStatus` (`src/context/AppContext.jsx:1082-1086`), which only updates the PO status (`src/lib/api.js:932-939`). No inventory or history changes. A user can see a PO as Received while stock remains unchanged.

PO creation itself is also non-atomic: it inserts the header, then line items (`src/lib/api.js:915-929`). The code writes `po_id`, while checked-in schema declares `purchase_order_id` (`supabase/schema.sql:154-163`).

### 5.13 Inventory adjustments

No active stock adjustment workflow was found. `inventoryApi.update` can accept `quantity` because it only removes `id` and `created_at` from `updates` (`src/lib/api.js:1054-1071`), but repository search found no caller. If later exposed, it would change balance without a transaction. Customer Ledger's “Adjust Balance” changes customer money only, not inventory (`src/pages/CustomerLedger.jsx:115-159`).

### 5.14 Returns

No stock-return workflow, return table, return movement type, or reversal RPC was found. Refund-like ledger support in unused cancellation code is not an inventory return model. Return policy and stock condition require business decisions.

### 5.15 Realtime inventory updates

`inventory` changes cause a branch reload, making the inventory table authoritative for current UI (`src/context/AppContext.jsx:404-413`). Transaction inserts are prepended without deduplication (`:415-425`). Realtime is a display synchronization mechanism; it does not make any multi-call workflow atomic and cannot prevent lost database updates.

### 5.16 Reports that calculate stock

- Current inventory summary, category quantities, and low-stock lists use `inventory.quantity` (`src/pages/Reports.jsx:317-331,428-465`).
- Movement reports use `transactions` and include only `Stock IN`, `Stock OUT`, and `Wastage` (`:230-250`).
- They omit normal `Fulfillment`, active fulfillment's `OUT`, and all POS deductions. Therefore movement totals cannot explain current balances.

### 5.17 Dashboard KPIs

- Current item/quantity/low/out-stock KPIs use branch-filtered inventory (`src/pages/Dashboard.jsx:236-238,269-319`).
- Movement KPIs/charts use branch-filtered transactions (`:242-243,275-335`). Several outflow filters include only `Stock OUT` and `Wastage`, not Fulfillment or POS.
- AppContext's separate shared stats include `Fulfillment` (`src/context/AppContext.jsx:1112-1118`), so even two in-app KPI implementations disagree.

### 5.18 Low-stock and out-of-stock logic

The same inventory quantity is used, but threshold columns differ:

- Inventory: `min_threshold` (`src/pages/Inventory.jsx:65,469-474`).
- AppContext stats: `min_threshold || min_stock || threshold` (`src/context/AppContext.jsx:1104-1107`).
- Dashboard: `threshold || min_stock` (`src/pages/Dashboard.jsx:269-270,309`).
- Reports: `threshold || min_stock` (`src/pages/Reports.jsx:324-327,462-465`).
- Active fulfillment: `threshold || min_stock` (`src/pages/FulfillmentCenter.jsx:268-271`).
- Checked-in template schema: `low_stock_threshold` (`supabase/schema.sql:80-90`).

An item can consequently be “Low” on Inventory and “OK” on Dashboard/Reports, or vice versa.

## 6. Source-of-Truth Verdict

**Verdict: the application has conflicting sources of truth (model C).**

More precisely:

- **Operational current balance:** `inventory.quantity`. The current Inventory page, Stock Movement validation, POS, fulfillment, Dashboard balance KPIs, Reports inventory summary, and realtime refresh all trust it.
- **Partial audit history:** `transactions`. Manual movement writes it, but POS does not. Active fulfillment tries to write a differently shaped row that likely fails against the checked-in schema and uses a type ignored by reports.
- **Documented but inactive model:** `supabase/schema.sql:34` and `src/lib/computeInventory.js:1-5` claim transactions are the source of truth. No caller of `computeInventory` was found.

| Area | Reads Current Stock From | Writes Current Stock To | Writes History To |
|---|---|---|---|
| Inventory page | `inventory.quantity` | none | none; reads transactions as history |
| Stock Movement | `inventory.quantity` | `inventory.quantity` | `transactions`, then activity |
| Active Fulfillment | `inventory.quantity` | `inventory.quantity` | attempted `transactions` row with incompatible shape |
| Active POS | `inventory.quantity` | `inventory.quantity` | `orders`/`order_items`, no stock movement |
| Purchase receiving | N/A | none | PO status only |
| Dashboard current KPIs | `inventory.quantity` | none | N/A |
| Dashboard movement KPIs | `transactions` | none | N/A |
| Reports current stock | `inventory.quantity` | none | N/A |
| Reports movements | `transactions` | none | N/A |
| `computeInventory` | transactions | none | N/A; apparently unused |

Because there is no reconciliation, neither source alone can reconstruct all business events reliably.

## 7. Critical Issues

The register contains **19 risks: 4 Critical, 8 High, 5 Medium, 2 Low**.

| ID | Severity | Description and evidence | Example failure and user-visible/data impact | Recommended future fix |
|---|---|---|---|---|
| R1 | Critical | Active POS independently inserts order, items, then loops direct quantity writes; no stock history and update results ignored (`src/components/pos/POS.jsx:404-473`). | Third item update fails: cashier sees success and a full receipt, order money is recorded, but stock is only partly deducted. Corrupts stock and history; may affect money reconciliation. | One idempotent database checkout RPC locking all inventory rows, validating stock, inserting order/items/payment/movements, and committing together. |
| R2 | Critical | Active fulfillment updates request/item first, inventory next, then best-effort incompatible history (`src/pages/FulfillmentCenter.jsx:203-303`). | Inventory succeeds but transaction insert fails on unknown columns: current stock falls, history omits dispatch; or request completes before inventory failure. Corrupts stock/workflow/history. | Atomic fulfillment RPC with request/item locks, remaining-quantity checks, canonical movement type/source, and one transaction. |
| R3 | Critical | Manual movement inserts history before balance and uses absolute read-modify-write (`src/lib/api.js:580-802`). | Two users both read 100 and deduct 10; both write 90, so one outflow is lost while two history rows exist. Or history commits and inventory update fails. Corrupts stock/history. | Atomic SQL function using row lock or guarded relative update and movement insert in the same transaction. |
| R4 | Critical | No checked-in branch RLS for inventory, transactions, orders, or requests; important writes filter only by ID, and active fulfillment history omits branch (`supabase/rls_policies.sql:1-19`; `FulfillmentCenter.jsx:255-291`). | A stale/tampered row ID or permissive grant could mutate another branch; branchless history is invisible to branch reports. Potential cross-branch stock/history corruption. | Verify live grants; add branch-scoped RLS tied to authenticated memberships; require branch in RPC and validate ownership server-side. |
| R5 | High | Full/partial fulfillment uses stale fulfilled and inventory snapshots; client locks are per mounted instance only (`FulfillmentCenter.jsx:52,169-205`). Pending requests are dispatchable (`:83-84`). | Two storekeepers dispatch the same request; quantities are double-deducted or one metadata update is lost. Approval can be bypassed. | Server-enforced status transition, row locks, remaining-quantity calculation, unique idempotency key. |
| R6 | High | Apparently unused cancellation is non-idempotent and restores by read-modify-write (`src/lib/pos.js:219-279`). | Double click/retry/calling cancellation twice adds stock twice; refund ledger may fail afterward. Corrupts stock, money, and history if activated. | Conditional `UPDATE ... WHERE status IN (...)`, cancellation movement unique by order/source, and one atomic RPC. |
| R7 | High | Reports and Dashboard combine current inventory with incomplete/differently filtered history (`Reports.jsx:230-250,317-331`; `Dashboard.jsx:269-335`). | POS sells 20 units: current stock drops, movement report shows no outflow; fulfillment type `OUT` is also omitted. Misleading operational and audit reports. | Canonical movement table/types; report all flows by source; add balance-vs-ledger reconciliation report. |
| R8 | High | “Received” purchase order only changes status (`PurchaseOrders.jsx:36`; `AppContext.jsx:1082-1086`; `api.js:932-939`). | Staff marks delivery received, assumes stock is available, but POS/fulfillment still show old quantity. Functional stock undercount. | Atomic receive workflow supporting partial receipts and receipt movements linked to PO lines. |
| R9 | High | Checked-in schema is missing 14 tables used by code and no migrations are tracked. Numerous columns conflict (Section 8). | Fresh deployment cannot reproduce runtime; a frontend insert may fail only in production. Integrity and security cannot be reviewed reliably. | Establish authoritative migrations generated/verified from live schema; CI type generation/schema checks. |
| R10 | High | Apparently unused POS completion/payment uses multiple calls, conflicting `ledger` name, and undefined `_now()` (`src/lib/pos.js:165-216,282-333`; `CustomerLedger.jsx:99-107`). | Order becomes paid/completed, then payment insert throws or ledger fails. Money records disagree even though order status changed. | Single payment/completion RPC and one canonical ledger schema; remove dead duplicate paths. |
| R11 | High | Active `POS.jsx`, unused `lib/pos.js`, and extracted unused POS components implement different generations of behavior. | A later refactor imports `posApi.placeOrder`, activating a second historyless deduction/cancellation model. Stock semantics change unintentionally. | Choose one orchestration layer, delete/quarantine dead implementations after tests, and prohibit direct quantity writes. |
| R12 | High | Apparently unused AppContext full/partial fulfillment loops multiple dual writes and updates metadata afterward (`AppContext.jsx:761-890`). | Second item fails after first is deducted; retry deducts the first again. Corrupts stock/request/history if activated. | Replace both with the same atomic idempotent fulfillment RPC used by active UI. |
| R13 | Medium | Optimistic transaction updates and realtime inserts have no ID dedupe (`StockMovement.jsx:402-465`; `AppContext.jsx:415-425,576-650`). | Same movement appears twice until reload; users may think stock moved twice even where database did not. Client history inconsistency. | Upsert client state by primary key or invalidate/refetch after mutation. |
| R14 | Medium | Unused `inventoryApi.create/update/remove` can create/change/delete balances without stock transactions (`src/lib/api.js:1008-1085`). | Future UI directly corrects quantity; current stock changes with no explainable movement. Stock/history corruption if activated. | Remove quantity from generic CRUD; adjustments must use an atomic movement RPC. Restrict delete when movements exist. |
| R15 | Medium | Threshold fields differ across Inventory, Dashboard, Reports, fulfillment, context, and schema (Section 5.18). | Same item shows Low Stock on one page and healthy on another. Operational alert inconsistency. | Canonical threshold column/view and shared status function; migrate data once. |
| R16 | Medium | Stock Movement failure “rollback” sets inventory state to `null` but does not directly refetch (`src/pages/StockMovement.jsx:378-381,455-460`). | Failed mutation can blank or destabilize inventory UI until another event/reload. Does not corrupt DB, but obscures real balance. | Explicitly invalidate/refetch current branch and dedupe transaction state. |
| R17 | Medium | No implemented stock-aware order editing, returns, or active adjustment workflow was found. | Staff performs an out-of-band correction or edits database rows, leaving no consistent reversal/audit trail. Process and history risk. | Decide business rules, then add source-linked reversal/adjustment movements through the same RPC. |
| R18 | Low | Activity logging is best effort; API logger swallows errors, and AppContext writes `description`/`metadata` absent from checked-in schema (`api.js:62-78`; `AppContext.jsx:926-938`; `schema.sql:166-174`). | Stock succeeds but human activity audit is absent. History/audit degradation, not balance corruption by itself. | Include required audit in atomic movement, or use an outbox; align activity schema. |
| R19 | Low | Comments/schema and unused `computeInventory` state that transactions are the only source while runtime trusts inventory (`schema.sql:34`; `computeInventory.js:1-5`; `AppContext.jsx:404-413`). | Maintainer “fixes” a page to derive from incomplete transactions, causing sudden stock differences. Maintenance risk. | Document chosen model, rename/deprecate dead utility, add architecture tests. |

### Direct answers to the atomicity questions

- **Does everything succeed or roll back together?** No important stock workflow found has all-or-nothing database behavior.
- **Can an order be created without order items?** Yes. The order insert commits before the order-items insert in both active and legacy POS.
- **Can inventory be deducted without a history record?** Yes. Active POS always does this; active fulfillment continues after history failure.
- **Can a ledger entry fail after an order succeeds?** Yes. Legacy complete/payment/cancel paths update the order before optional ledger writes.
- **Can cancellation restore stock twice?** Yes, in the apparently unused legacy cancellation path; there is no prior-status guard or idempotency.
- **Can two users overwrite each other's quantities?** Yes. Manual movement, fulfillment, POS placement, and legacy cancellation use client-side read-modify-write absolute values.

## 8. Schema Drift

### Tables used in code but missing from `supabase/schema.sql`

Repository Supabase calls reference 25 table names. The schema declares 11. The following 14 code-used tables are not declared:

`branch_members`, `categories`, `customer_transactions`, `customers`, `inventory`, `ledger`, `ledger_entries`, `notifications`, `order_items`, `order_payments`, `orders`, `request_items`, `requests`, `user_roles`.

`inventory_movements` is neither declared nor used. No tracked migrations directory/files were found to supply the missing definitions.

### Conflicting models and names

| Conflict | Code evidence | Schema evidence / impact |
|---|---|---|
| Current balance vs history | Runtime reads/writes `inventory`; history in `transactions` | Schema declares transactions and says inventory is derived, but does not declare inventory (`schema.sql:34`) |
| `requests`/`request_items` vs `demands` | Active AppContext and pages use requests (`AppContext.jsx:266-290,656-890`) | Schema declares only `demands` (`schema.sql:53-77`); old `demandsApi` remains at `api.js:810-858` |
| `po_id` vs `purchase_order_id` | `api.js:923-928` writes `po_id` | `schema.sql:154-163` declares `purchase_order_id` |
| `ledger` vs `ledger_entries` vs `customer_transactions` | `lib/pos.js:198,261,315`; `CustomerLedger.jsx:99-136`; other API calls use customer transactions | None is declared; order/payment and Customer Ledger cannot be assumed to share a ledger |
| `branch_members` vs `user_branch_mappings` | Branch API calls `branch_members` | Schema declares `user_branch_mappings` at `schema.sql:25-32` |
| POS implementations | Active `POS.jsx` writes directly; `lib/pos.js` exposes a different service; extracted components target `api.js` POS search API | No matching order schema to establish intended generation |

### Important column mismatches

- Active fulfillment inserts `transactions.item_id`, `reference_type`, `reference_id`, `created_by`, and `created_by_name`, none of which exist in `supabase/schema.sql:35-50`. It omits required `branch_id` for branch reporting and uses type `OUT` instead of the application's `Stock OUT`/`Fulfillment` vocabulary (`src/pages/FulfillmentCenter.jsx:279-291`). `branch_id` is nullable in the checked-in schema, so a branchless insert could also succeed and disappear from scoped reads.
- AppContext activity calls use `description` and `metadata`, while schema has `details` only (`src/context/AppContext.jsx:926-934`; `supabase/schema.sql:166-174`).
- Code selects/uses `users.auth_id`, `full_name`, and other fields not in the checked-in users table; the RLS policy itself references missing `auth_id` (`src/lib/api.js:24`; `supabase/schema.sql:13-23`; `supabase/rls_policies.sql:10,18-19`).
- `posApi.getBranches` selects and filters `branches.is_active`, absent from schema (`src/lib/pos.js:59-65`; `supabase/schema.sql:5-10`).
- Runtime inventory columns (`quantity`, `purchase_price`, `selling_price`, threshold variants, timestamps) cannot be checked because the inventory table is entirely absent.
- AppContext request paths use approval/completion fields on tables absent from schema; deployed column availability is unknown.
- The PO/UI model appears richer than the checked-in PO schema, and line insert uses the wrong foreign-key name as noted above.

### SQL functions, triggers, Edge Functions, and RLS

- No stock-mutating `.rpc(...)` call was found. The only application RPC search hit is user deletion (`src/pages/UserManagement.jsx:304`).
- No SQL stock function, trigger, or inventory movement function was found.
- Edge Functions under `supabase/functions/` manage users only; they do not mutate stock.
- `supabase/rls_policies.sql` contains only own-user profile policies. The schema file merely contains commented development RLS lines (`supabase/schema.sql:176-181`).
- Live database triggers, generated functions, policies, grants, and schema may differ; repository evidence cannot verify them.

## 9. Recommended Target Architecture

The proposed target is suitable for the code found:

1. **`inventory.quantity` remains the fast current balance.** Existing pages already depend on it, so retaining it avoids an expensive first migration to event-only reads.
2. **Add immutable `inventory_movements` as the complete audit ledger.** Every change records `branch_id`, `inventory_id`, signed quantity delta, balance before/after, canonical movement type, `source_type`, `source_id`, actor, timestamp, and idempotency key. Do not edit/delete movements; reverse them with a new movement.
3. **Route every quantity change through database functions/RPCs.** Functions lock the inventory row, validate branch/status/stock, perform a relative or locked balance update, insert the movement, and perform source workflow changes in one SQL transaction.
4. **Use source-specific atomic functions where multiple aggregates are involved.** Examples: `receive_purchase_order`, `fulfill_request`, `place_pos_order`, `cancel_pos_order`, `adjust_inventory`, and `return_pos_items`. A shared internal movement function can enforce invariants.
5. **Enforce idempotency.** Unique keys such as `(source_type, source_id, source_line_id, operation)` prevent duplicate checkout, fulfillment, receipt, cancellation, and reversal.
6. **Enforce branch security in the database.** RLS must validate authenticated membership for inventory, movements, orders, requests, and related lines. RPCs must derive or validate branch server-side.
7. **Make reports use movements for flows and inventory for current balances.** Add a reconciliation query comparing inventory balance with a movement-derived balance after an agreed opening balance/backfill point.

This design gives the app efficient current reads while making every balance explainable. It is safer than making existing `transactions` the ledger because that table is already incomplete, its type vocabulary has drifted, it lacks strong source linkage, and it is coupled to older UI assumptions.

## 10. Safe Migration Plan

1. **Audit and backup**
   - Export live schema, functions, triggers, policies, grants, and row counts.
   - Backup `inventory`, `transactions`, orders/items, requests/items, purchase orders/items, branches, users, and ledger tables.
   - Freeze a precise schema snapshot in migrations; do not assume `schema.sql` matches production.

2. **Define canonical vocabulary and invariants**
   - Decide movement types, source types, sign rules, branch ownership, negative-stock policy, unit precision, opening balances, and cancellation/return rules.
   - Add database constraints and unique inventory identity per branch/item.

3. **Add `inventory_movements` without switching behavior**
   - Include source linkage and idempotency fields.
   - Add branch-scoped RLS and indexes.
   - Do not dual-write from the browser.

4. **Add atomic stock function(s)**
   - Lock inventory row; validate expected source/status and available balance; update quantity; insert movement; return new balance.
   - Add concurrency, duplicate-call, wrong-branch, insufficient-stock, and rollback tests.

5. **Convert one low-complexity workflow at a time**
   - Manual Stock IN, then Stock OUT/Wastage.
   - Active fulfillment.
   - PO partial receiving.
   - POS placement/payment/completion according to agreed business state model.
   - Cancellation, returns, and adjustments last, once rules are approved.

6. **Backfill and reconcile**
   - Preserve existing transactions as imported movements where mapping is trustworthy.
   - Represent unexplained differences with reviewed opening-balance/reconciliation movements, never fabricated sales or receipts.
   - Explicitly link recoverable POS orders and fulfillments.

7. **Run parallel comparison**
   - Compare `inventory.quantity` with movement-derived balances per branch/item daily.
   - Block cutover until differences are classified and resolved.

8. **Switch reports and realtime**
   - Flow reports read movements; balance cards read inventory.
   - Realtime invalidates/refetches by primary key and deduplicates movements.

9. **Remove obsolete paths later**
   - Revoke direct client updates to `inventory.quantity`.
   - Remove unused `computeInventory`, old `demandsApi`, duplicate Requests/POS paths, and legacy ledger naming only after production verification and tests.

## 11. Questions Requiring Business Decisions

1. At which POS state should stock move: order placement, payment, completion, kitchen acceptance, or another state?
2. Are pending POS orders reservations, hard deductions, or neither?
3. Can a POS order be edited after stock moves? If so, which roles and states allow it, and should edits create delta movements?
4. Can cancelled orders be reopened? Is cancellation always a full stock restoration, and what happens to prepared/wasted items?
5. How are returns handled: restock, damaged/wastage, exchange, or financial refund only? Are partial line returns allowed?
6. Must demands be approved before dispatch? The current UI permits dispatch from Pending.
7. For full dispatch after a partial dispatch, should “full” mean the original request or only the remaining quantity?
8. Is branch supply a sale, an internal transfer, or a fulfillment? A transfer needs paired source/destination movements.
9. Does marking a PO Received imply full receipt, or must partial receipts, rejected quantities, and over-delivery be supported?
10. May stock ever be negative? Current `Math.max(0)` behavior silently clamps instead of expressing backorders/shortage.
11. What is the canonical inventory identity: template ID, inventory row ID, SKU, or branch + normalized name? Current workflows frequently match by name.
12. Which threshold field is authoritative, and is it stored per template, per branch inventory row, or both?
13. How should historical unexplained differences be represented during backfill?
14. Which ledger table is canonical for customer money, and must POS completion and ledger posting be atomic?

## 12. Final Priority List

The next five safest implementation tasks, each suitable for its own branch, are:

1. **Capture and version the actual Supabase schema/RLS.** Add authoritative migrations and generated types without changing inventory behavior; reconcile every missing table/column first.
2. **Add a read-only reconciliation tool/report.** Compare current inventory with legacy transaction-derived balances by branch/item and classify POS/fulfillment gaps; make no automatic corrections.
3. **Add canonical `inventory_movements` plus branch RLS and tests.** Introduce the immutable table and constraints without switching production writers.
4. **Implement and adopt an atomic manual movement RPC.** Convert Stock IN/OUT/Wastage first, with concurrency and rollback tests; then revoke that direct quantity-write path.
5. **Implement an atomic fulfillment RPC and convert `FulfillmentCenter`.** Enforce approval/remaining quantity/idempotency, write canonical movements, and remove the duplicate AppContext fulfillment implementation after verification.

POS should follow immediately afterward in a dedicated branch because it requires business decisions about placement, payment, completion, cancellation, returns, and customer ledger atomicity.

---

## Audit Completion Metrics

- **Files inspected:** 130 tracked repository files inventoried; all 61 tracked files under `src/`, `supabase/`, and the requested migration scope were searched, with the stock-critical UI, context, service, schema, policy, and Edge Function files reviewed line-by-line. No tracked migration files were present.
- **Search terms used:** `inventory`, `inventory.quantity`, `quantity`, `transactions`, `stock_in`, `stock out`, `stock_out`, `wastage`, `fulfillment`, `partial fulfillment`, `return`, `refund`, `cancelOrder`, `completeOrder`, `processPayment`, `edit order`, `purchase receiving`, `Received`, `adjustment`, `low stock`, `inventory movement`, `inventory_movements`, `computeInventory`, `.from('inventory')`, `.from('transactions')`, `.update({ quantity`, `.insert`, `.delete`, `.rpc`, `postgres_changes`, `activity_logs`, `branch_id`, `RLS`, `CREATE POLICY`, and all table names emitted by Supabase calls.
- **Total important stock-read paths found:** 22 (Section 3; includes 6 apparently unused/legacy component/service paths).
- **Total stock-write entry paths found:** 14 (Section 4; includes 7 active/manual UI paths and 7 apparently unused/legacy CRUD/service paths). Purchase receiving was additionally traced and confirmed not to write stock.
- **Risk counts:** 4 Critical, 8 High, 5 Medium, 2 Low (19 total).
- **Areas that could not be verified:** production/live Supabase schema and data; deployed migrations not in the repository; database triggers/functions not checked in; actual RLS enablement, policies, grants, and JWT claims; realtime publication configuration; uniqueness/foreign-key/check constraints on missing tables; whether unused exported functions are called by external consumers; historical data quality; deployment version; business rules for POS state transitions, returns, edits, transfers, negative stock, PO partial receiving, and demand approval.

