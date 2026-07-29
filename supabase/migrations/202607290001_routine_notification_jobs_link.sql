alter table public.care_plans
  add column if not exists notification_time time not null default '09:00';

create unique index if not exists routine_notification_jobs_routine_date_unique
  on public.routine_notification_jobs(routine_id, routine_date);
