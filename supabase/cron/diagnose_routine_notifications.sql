-- Read-only checks for routine push timing. Run in the Supabase SQL editor.

select jobid, jobname, schedule, active
from cron.job
where jobname in (
  'materialize-routine-notification-window',
  'send-routine-notifications-every-minute'
)
order by jobname;

select jobid, status, start_time, end_time, return_message
from cron.job_run_details
where jobid in (
  select jobid from cron.job
  where jobname = 'send-routine-notifications-every-minute'
)
order by start_time desc
limit 10;

select
  status,
  notification_type,
  routine_date,
  scheduled_at,
  next_notification_at,
  sent_at,
  attempt_count,
  extract(epoch from (coalesce(sent_at, now()) - next_notification_at))::integer as delay_seconds
from public.routine_notification_jobs
order by created_at desc
limit 30;

select is_active, count(*) as subscription_count
from public.push_subscriptions
group by is_active
order by is_active desc;
