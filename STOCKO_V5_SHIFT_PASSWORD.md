# Stocko v5 — Shift close password confirmation

- Manager, Admin, or Developer must enter their currently signed-in account password every time they close a shift.
- The password is verified directly with Supabase Auth and is never stored by Stocko.
- Wrong/missing password leaves the current shift open.
- After successful verification, the existing secure `close_business_shift` RPC closes the shift and opens the next shift at the same timestamp.
- The database RPC continues to enforce the Manager/Admin/Developer role restriction.

No new SQL migration is required if `20260927_manual_shift_handover.sql` from v4 has already been run.
