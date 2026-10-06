# Stocko v8 — Assignment History

- Assignment History defaults to the business date of the currently open shift.
- History selects records by `business_shifts.opened_at` / `task_occurrences.shift_id`, not completion calendar date.
- Tasks completed after midnight remain under the shift that started the previous business date.
- Results are grouped by Branch + Shift.
- From/To date filters select business shift start dates.
- Existing staff, branch, status and search filters remain available.
- No new SQL migration is required beyond the v7 shift_id migration.
