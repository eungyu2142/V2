create or replace function public.claim_due_routine_notification_jobs(
  p_limit integer default 50
)
returns setof public.routine_notification_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with due_jobs as (
    select jobs.id
    from public.routine_notification_jobs as jobs
    where jobs.status = 'pending'
      and jobs.next_notification_at is not null
      and jobs.next_notification_at <= now()
    order by jobs.next_notification_at asc, jobs.created_at asc
    for update skip locked
    limit least(greatest(coalesce(p_limit, 50), 1), 100)
  ),
  claimed_jobs as (
    update public.routine_notification_jobs as jobs
    set
      status = 'processing',
      updated_at = now()
    from due_jobs
    where jobs.id = due_jobs.id
      and jobs.status = 'pending'
    returning jobs.*
  )
  select *
  from claimed_jobs;
end;
$$;

revoke all on function public.claim_due_routine_notification_jobs(integer) from public;
revoke all on function public.claim_due_routine_notification_jobs(integer) from anon;
revoke all on function public.claim_due_routine_notification_jobs(integer) from authenticated;
grant execute on function public.claim_due_routine_notification_jobs(integer) to service_role;
