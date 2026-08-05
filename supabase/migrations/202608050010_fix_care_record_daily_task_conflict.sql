-- A regular unique index still allows multiple NULL values and can be inferred
-- by ON CONFLICT (daily_task_id) inside complete_daily_task.
drop index if exists public.care_records_daily_task_unique;

create unique index care_records_daily_task_unique
  on public.care_records (daily_task_id);
