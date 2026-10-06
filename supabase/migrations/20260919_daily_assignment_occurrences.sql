-- Daily assignments are recurring templates, not one-time rows.
-- Completing a daily task creates only an occurrence record for that date.
-- The same assignment therefore remains available on the next date without
-- the admin creating it again.
--
-- Existing data does not need one completion row per future day. The app
-- derives the current occurrence from assignments.recurrence='daily' and the
-- user's local date, then reads/writes assignment_completions for that date.

alter table if exists public.assignments
  add column if not exists recurrence text default 'daily';

update public.assignments
set recurrence = 'daily'
where recurrence is null or btrim(recurrence) = '';

-- Daily/weekly assignments should not depend on scheduled_date. Keep that
-- column only for one-time/scheduled assignments.
update public.assignments
set scheduled_date = null
where recurrence = 'daily';
