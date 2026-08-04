-- Read-only operational assertions. Run in the Supabase SQL editor after the
-- notification migrations have been applied.
do $$
begin
  if public.seoul_scheduled_at(date '2026-08-05', time '00:05')
    <> timestamptz '2026-08-04 15:05:00+00' then
    raise exception 'Asia/Seoul conversion is incorrect';
  end if;

  if exists (
    select endpoint from public.push_subscriptions group by endpoint having count(*) > 1
  ) then raise exception 'Duplicate push subscription endpoint exists'; end if;

  if exists (
    select dedupe_key from public.routine_notification_jobs
    where dedupe_key is not null group by dedupe_key having count(*) > 1
  ) then raise exception 'Duplicate notification dedupe key exists'; end if;

  if exists (
    select care_plan_id, scheduled_date, occurrence_no
    from public.daily_tasks where care_plan_id is not null
    group by care_plan_id, scheduled_date, occurrence_no having count(*) > 1
  ) then raise exception 'Duplicate routine occurrence exists'; end if;

  if exists (
    select 1
    from public.routine_notification_jobs jobs
    join public.daily_tasks tasks on tasks.id = jobs.occurrence_id
    where tasks.status in ('completed', 'skipped')
      and jobs.status in ('pending', 'processing')
  ) then raise exception 'Completed occurrence still has a live notification'; end if;

  if not exists (
    select 1 from cron.job where jobname = 'materialize-routine-notification-window' and active
  ) then raise exception 'Daily rolling-window cron is inactive'; end if;

  if not exists (
    select 1 from cron.job where jobname = 'send-routine-notifications-every-minute' and active
  ) then raise exception 'Per-minute notification cron is inactive'; end if;
end;
$$;

select
  (select count(*) from public.care_plans where is_active) as active_routines,
  (select count(*) from public.daily_tasks where status = 'pending') as pending_occurrences,
  (select count(*) from public.routine_notification_jobs where status = 'pending') as pending_jobs,
  (select count(*) from public.push_subscriptions where is_active) as active_devices;
