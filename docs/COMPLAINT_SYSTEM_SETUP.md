# Stocko Complaint & Feedback System

This change is additive and is designed for the running Stocko project.

## 1. Apply the database migration

Run this file in Supabase SQL Editor (or deploy it through your normal migration workflow):

`supabase/migrations/20260901_complaints_master_rbac.sql`

It adds:

- `complaint_qr_codes`
- `customer_complaints`
- `complaint_status_history`
- public QR lookup/submission RPCs
- complaint notifications to active branch Managers/Admins
- RLS for branch isolation and Master global read access
- Master/Admin role-assignment protections

## 2. Deploy the updated Edge Functions

Deploy these updated functions because the role restriction must be enforced server-side:

- `supabase/functions/create-user`
- `supabase/functions/update-user`

Manager cannot assign `Admin` or `Master`.
Only Developer can assign `Master`.

## 3. Customer QR behavior

### Delivery customer QR

The QR opens:

`/complaint/<secure-token>`

The customer must enter an order/invoice number manually. Stocko validates that the order belongs to the QR's branch before accepting the submission.

### Dine-in table QR

Each table gets its own QR. The table number is encoded server-side in the QR record, so the customer does not enter it.

The order number is optional for dine-in.

## 4. Staff page

Authenticated staff with Developer/Admin/Manager access get:

**Complaints & Feedback**

- status filters
- date filters
- Delivery/Dine-in filter
- search
- complaint details
- manager notes
- status changes
- status history
- branch routing

The QR Codes tab can create/print table QR codes and delivery customer QR codes.

Master can view complaints and QR records across all branches, but cannot change complaint status unless separately granted a management role. Master is not a branch-assigned role.

## 5. QR image note

The print preview uses QuickChart's QR image endpoint to render the QR without adding another npm dependency. The QR itself contains only the Stocko complaint URL and a random server-generated token.

## 6. Important production check

Before production rollout, verify the existing live `orders` and `customers` tables contain the fields Stocko already uses (`invoice_no`, `reference`, `branch_id`, customer `id/name`, etc.). The migration intentionally does not rewrite those existing POS tables.


## Delivery QR rule

Each branch has exactly one active Delivery Complaint QR. The QR is branch-specific, not customer-specific. The customer must enter the order/invoice number after scanning.

## Public URL

All complaint QR codes encode `https://stocko.website/complaint/<token>` so scanning works on the production domain.
