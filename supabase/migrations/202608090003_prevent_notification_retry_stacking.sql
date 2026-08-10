-- A later occurrence replaces the previous occurrence's next-day reminder.
-- Without this cleanup, daily routines accumulate one additional reminder per
-- unfinished date even though the newer occurrence already has its own alert.
create or replace function public.cancel_superseded_routine_notification_jobs()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  affected integer := 0;
begin
  update public.routine_notification_jobs as older
  set status = 'cancelled', updated_at = now()
  where older.notification_type = 'retry-next-day'
    and older.status in ('pending', 'processing', 'failed')
    and exists (
      select 1
      from public.routine_notification_jobs as newer
      where newer.routine_id = older.routine_id
        and newer.notification_type = 'initial'
        and newer.routine_date > older.routine_date
        and newer.routine_date <= (older.next_notification_at at time zone 'Asia/Seoul')::date
        and newer.status in ('pending', 'processing', 'sent')
    );
  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.claim_due_routine_notification_jobs(p_limit integer default 50)
returns setof public.routine_notification_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.cancel_superseded_routine_notification_jobs();

  update public.routine_notification_jobs
  set status = 'pending', updated_at = now()
  where status = 'processing' and updated_at < now() - interval '10 minutes';

  update public.routine_notification_jobs as jobs
  set status = 'cancelled', updated_at = now()
  from public.daily_tasks as tasks
  where jobs.occurrence_id = tasks.id
    and tasks.status in ('completed', 'skipped')
    and jobs.status in ('pending', 'processing', 'failed');

  return query
  with due_jobs as (
    select jobs.id
    from public.routine_notification_jobs as jobs
    join public.daily_tasks as tasks on tasks.id = jobs.occurrence_id
    where jobs.status = 'pending'
      and tasks.status = 'pending'
      and jobs.next_notification_at <= now()
    order by jobs.next_notification_at, jobs.created_at
    for update of jobs skip locked
    limit least(greatest(coalesce(p_limit, 50), 1), 100)
  ), claimed as (
    update public.routine_notification_jobs as jobs
    set status = 'processing', attempt_count = jobs.attempt_count + 1, updated_at = now()
    from due_jobs
    where jobs.id = due_jobs.id and jobs.status = 'pending'
    returning jobs.*
  )
  select * from claimed;
end;
$$;

-- Clean up rows that have already accumulated before this migration.
select public.cancel_superseded_routine_notification_jobs();

revoke all on function public.cancel_superseded_routine_notification_jobs() from public, anon, authenticated;
grant execute on function public.cancel_superseded_routine_notification_jobs() to service_role;
revoke all on function public.claim_due_routine_notification_jobs(integer) from public, anon, authenticated;
grant execute on function public.claim_due_routine_notification_jobs(integer) to service_role;
