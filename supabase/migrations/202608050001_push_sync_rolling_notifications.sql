-- Keep the existing care_plans/daily_tasks model: care_plans are recurring
-- routines and daily_tasks are their date-based occurrences.

create extension if not exists pg_cron with schema pg_catalog;

-- A browser endpoint identifies one concrete push subscription. Keep the most
-- recently updated row before enforcing global uniqueness.
with ranked_subscriptions as (
  select id, row_number() over (
    partition by endpoint
    order by is_active desc, updated_at desc nulls last, created_at desc nulls last, id desc
  ) as position
  from public.push_subscriptions
)
delete from public.push_subscriptions as subscriptions
using ranked_subscriptions as ranked
where subscriptions.id = ranked.id
  and ranked.position > 1;

create unique index if not exists push_subscriptions_endpoint_unique
  on public.push_subscriptions(endpoint);

alter table public.care_plans
  add column if not exists recurrence_type text not null default 'weekdays',
  add column if not exists recurrence_interval_days integer not null default 1;

alter table public.care_plans drop constraint if exists care_plans_recurrence_type_check;
alter table public.care_plans add constraint care_plans_recurrence_type_check
  check (recurrence_type in ('weekdays', 'interval'));
alter table public.care_plans drop constraint if exists care_plans_recurrence_interval_check;
alter table public.care_plans add constraint care_plans_recurrence_interval_check
  check (recurrence_interval_days between 1 and 365);

alter table public.routine_notification_jobs
  add column if not exists occurrence_id uuid references public.daily_tasks(id) on delete cascade,
  add column if not exists notification_type text,
  add column if not exists sent_at timestamptz,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists dedupe_key text;

drop index if exists public.routine_notification_jobs_routine_date_unique;

update public.routine_notification_jobs as jobs
set occurrence_id = tasks.id
from public.daily_tasks as tasks
where jobs.occurrence_id is null
  and tasks.care_plan_id::text = jobs.routine_id::text
  and tasks.scheduled_date = jobs.routine_date;

update public.routine_notification_jobs
set notification_type = case notification_stage
  when 2 then 'retry-10m'
  when 3 then 'retry-next-day'
  else 'initial'
end
where notification_type is null;

update public.routine_notification_jobs
set dedupe_key = concat(
  'routine:', routine_id,
  ':occurrence:', coalesce(occurrence_id::text, routine_date::text),
  ':', notification_type
)
where dedupe_key is null;

with ranked_jobs as (
  select id, row_number() over (
    partition by dedupe_key
    order by updated_at desc nulls last, created_at desc nulls last, id desc
  ) as position
  from public.routine_notification_jobs
  where dedupe_key is not null
)
delete from public.routine_notification_jobs as jobs
using ranked_jobs as ranked
where jobs.id = ranked.id
  and ranked.position > 1;

create unique index if not exists routine_notification_jobs_dedupe_key_unique
  on public.routine_notification_jobs(dedupe_key)
  where dedupe_key is not null;
create index if not exists routine_notification_jobs_due_idx
  on public.routine_notification_jobs(status, next_notification_at)
  where status = 'pending';
create index if not exists routine_notification_jobs_occurrence_idx
  on public.routine_notification_jobs(occurrence_id, status);

alter table public.routine_notification_jobs drop constraint if exists routine_notification_jobs_status_check;
alter table public.routine_notification_jobs add constraint routine_notification_jobs_status_check
  check (status in ('pending', 'processing', 'sent', 'failed', 'cancelled', 'completed', 'skipped'));

alter table public.routine_notification_jobs drop constraint if exists routine_notification_jobs_notification_type_check;
alter table public.routine_notification_jobs add constraint routine_notification_jobs_notification_type_check
  check (notification_type is null or notification_type in ('initial', 'retry-10m', 'retry-next-day'));

create or replace function public.seoul_scheduled_at(p_date date, p_time time)
returns timestamptz
language sql
immutable
strict
as $$
  select (p_date + p_time) at time zone 'Asia/Seoul';
$$;

create or replace function public.care_plan_occurs_on(p_plan public.care_plans, p_date date)
returns boolean
language sql
immutable
strict
as $$
  select case
    when p_date < p_plan.start_date then false
    when p_plan.end_date is not null and p_date > p_plan.end_date then false
    when p_plan.recurrence_type = 'interval' then
      ((p_date - p_plan.start_date) % greatest(p_plan.recurrence_interval_days, 1)) = 0
    when cardinality(p_plan.repeat_days) = 0 then true
    else extract(dow from p_date)::smallint = any(p_plan.repeat_days)
  end;
$$;

create or replace function public.materialize_routine_notification_window(
  p_routine_id uuid,
  p_from_date date default null,
  p_days integer default 14
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  plan_row public.care_plans;
  current_date_value date;
  window_start date := coalesce(p_from_date, timezone('Asia/Seoul', now())::date);
  window_end date;
  occurrence_row public.daily_tasks;
  initial_at timestamptz;
  inserted_occurrences integer := 0;
  inserted_jobs integer := 0;
  affected_jobs integer := 0;
begin
  if p_days < 1 or p_days > 60 then
    raise exception 'window days must be between 1 and 60';
  end if;

  select * into plan_row
  from public.care_plans
  where id = p_routine_id;

  if plan_row.id is null then raise exception 'care plan not found'; end if;
  if auth.uid() is not null and plan_row.user_id <> auth.uid() then
    raise exception 'care plan access denied';
  end if;
  if not plan_row.is_active then
    return jsonb_build_object('occurrences', 0, 'jobs', 0);
  end if;

  window_end := window_start + (p_days - 1);
  current_date_value := greatest(plan_row.start_date, window_start);

  while current_date_value <= least(coalesce(plan_row.end_date, window_end), window_end) loop
    if public.care_plan_occurs_on(plan_row, current_date_value) then
      insert into public.daily_tasks (
        user_id, care_plan_id, pet_id, task_type, scheduled_date, occurrence_no
      ) values (
        plan_row.user_id, plan_row.id, plan_row.pet_id, plan_row.task_type, current_date_value, 1
      )
      on conflict do nothing;
      if found then inserted_occurrences := inserted_occurrences + 1; end if;

      select * into occurrence_row
      from public.daily_tasks
      where care_plan_id = plan_row.id
        and scheduled_date = current_date_value
        and occurrence_no = 1;

      if occurrence_row.id is not null and occurrence_row.status = 'pending' then
        initial_at := public.seoul_scheduled_at(current_date_value, plan_row.notification_time);

        insert into public.routine_notification_jobs (
          user_id, pet_id, routine_id, routine_date, occurrence_id,
          scheduled_at, next_notification_at, notification_stage,
          notification_type, status, attempt_count, dedupe_key, updated_at
        ) values (
          plan_row.user_id::text, plan_row.pet_id::text, plan_row.id::text, current_date_value,
          occurrence_row.id, initial_at, initial_at, 1, 'initial', 'pending', 0,
          concat('routine:', plan_row.id, ':occurrence:', occurrence_row.id, ':initial'), now()
        )
        on conflict (dedupe_key) where dedupe_key is not null do update set
          scheduled_at = excluded.scheduled_at,
          next_notification_at = excluded.next_notification_at,
          status = case
            when routine_notification_jobs.status in ('cancelled', 'failed') then 'pending'
            else routine_notification_jobs.status
          end,
          attempt_count = case
            when routine_notification_jobs.status in ('cancelled', 'failed') then 0
            else routine_notification_jobs.attempt_count
          end,
          updated_at = now();
        get diagnostics affected_jobs = row_count;
        inserted_jobs := inserted_jobs + affected_jobs;
      end if;
    end if;
    current_date_value := current_date_value + 1;
  end loop;

  return jsonb_build_object('occurrences', inserted_occurrences, 'jobs', inserted_jobs);
end;
$$;

create or replace function public.materialize_my_routine_notification_windows(
  p_from_date date default null,
  p_days integer default 14
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  plan_row record;
  result jsonb;
  plan_count integer := 0;
begin
  for plan_row in
    select id from public.care_plans where user_id = auth.uid() and is_active
  loop
    result := public.materialize_routine_notification_window(plan_row.id, p_from_date, p_days);
    plan_count := plan_count + 1;
  end loop;
  return jsonb_build_object('plans', plan_count);
end;
$$;

create or replace function public.materialize_all_routine_notification_windows(
  p_from_date date default null,
  p_days integer default 14
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  plan_row record;
  result jsonb;
  plan_count integer := 0;
begin
  for plan_row in select id from public.care_plans where is_active loop
    result := public.materialize_routine_notification_window(plan_row.id, p_from_date, p_days);
    plan_count := plan_count + 1;
  end loop;
  return jsonb_build_object('plans', plan_count);
end;
$$;

create or replace function public.refresh_routine_notification_window(
  p_routine_id uuid,
  p_from_date date default null,
  p_days integer default 14
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  plan_row public.care_plans;
  window_start date := coalesce(p_from_date, timezone('Asia/Seoul', now())::date);
begin
  select * into plan_row from public.care_plans where id = p_routine_id;
  if plan_row.id is null then raise exception 'care plan not found'; end if;
  if auth.uid() is not null and plan_row.user_id <> auth.uid() then raise exception 'care plan access denied'; end if;

  update public.routine_notification_jobs as jobs
  set status = 'cancelled', updated_at = now()
  from public.daily_tasks as tasks
  where jobs.occurrence_id = tasks.id
    and tasks.care_plan_id = p_routine_id
    and tasks.scheduled_date >= window_start
    and jobs.status in ('pending', 'processing', 'failed');

  delete from public.daily_tasks
  where care_plan_id = p_routine_id
    and scheduled_date >= window_start
    and status = 'pending';

  return public.materialize_routine_notification_window(p_routine_id, window_start, p_days);
end;
$$;

create or replace function public.cancel_occurrence_notification_jobs(p_occurrence_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid;
  affected integer;
begin
  select user_id into owner_id from public.daily_tasks where id = p_occurrence_id;
  if owner_id is null then return 0; end if;
  if auth.uid() is not null and owner_id <> auth.uid() then raise exception 'occurrence access denied'; end if;

  update public.routine_notification_jobs
  set status = 'cancelled', updated_at = now()
  where occurrence_id = p_occurrence_id
    and status in ('pending', 'processing', 'failed');
  get diagnostics affected = row_count;
  return affected;
end;
$$;

create or replace function public.sync_occurrence_notification_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('completed', 'skipped') and old.status is distinct from new.status then
    update public.routine_notification_jobs
    set status = 'cancelled', updated_at = now()
    where occurrence_id = new.id
      and status in ('pending', 'processing', 'failed');
  elsif new.status = 'pending' and old.status in ('completed', 'skipped') then
    update public.routine_notification_jobs
    set status = 'pending', attempt_count = 0, updated_at = now()
    where occurrence_id = new.id
      and status in ('cancelled', 'failed')
      and sent_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists daily_tasks_sync_notification_status on public.daily_tasks;
create trigger daily_tasks_sync_notification_status
after update of status on public.daily_tasks
for each row execute function public.sync_occurrence_notification_status();

create or replace function public.archive_care_plan(p_routine_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.care_plans
  set is_active = false, updated_at = now()
  where id = p_routine_id and user_id = auth.uid();

  if not found then raise exception 'care plan not found'; end if;

  update public.routine_notification_jobs
  set status = 'cancelled', updated_at = now()
  where routine_id = p_routine_id::text
    and status in ('pending', 'processing', 'failed');

  delete from public.daily_tasks
  where care_plan_id = p_routine_id
    and user_id = auth.uid()
    and status = 'pending'
    and scheduled_date >= timezone('Asia/Seoul', now())::date;
end;
$$;

create or replace function public.materialize_daily_tasks(
  p_pet_id uuid,
  p_from_date date,
  p_to_date date
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  plan_row public.care_plans;
  current_date_value date;
  inserted_count integer := 0;
begin
  if p_from_date > p_to_date then return 0; end if;
  for plan_row in
    select * from public.care_plans
    where user_id = auth.uid()
      and is_active
      and (p_pet_id is null or pet_id = p_pet_id)
      and start_date <= p_to_date
      and (end_date is null or end_date >= p_from_date)
  loop
    current_date_value := greatest(plan_row.start_date, p_from_date);
    while current_date_value <= least(coalesce(plan_row.end_date, p_to_date), p_to_date) loop
      if public.care_plan_occurs_on(plan_row, current_date_value) then
        insert into public.daily_tasks (user_id, care_plan_id, pet_id, task_type, scheduled_date, occurrence_no)
        values (plan_row.user_id, plan_row.id, plan_row.pet_id, plan_row.task_type, current_date_value, 1)
        on conflict do nothing;
        if found then inserted_count := inserted_count + 1; end if;
      end if;
      current_date_value := current_date_value + 1;
    end loop;
  end loop;
  return inserted_count;
end;
$$;

create or replace function public.sync_current_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text
)
returns public.push_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  subscription_row public.push_subscriptions;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if nullif(trim(p_endpoint), '') is null or nullif(trim(p_p256dh), '') is null or nullif(trim(p_auth), '') is null then
    raise exception 'push subscription keys are required';
  end if;

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, is_active, updated_at)
  values (auth.uid()::text, trim(p_endpoint), trim(p_p256dh), trim(p_auth), coalesce(p_user_agent, ''), true, now())
  on conflict (endpoint) do update set
    user_id = excluded.user_id,
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    user_agent = excluded.user_agent,
    is_active = true,
    updated_at = now()
  returning * into subscription_row;
  return subscription_row;
end;
$$;

create or replace function public.deactivate_current_push_subscription(p_endpoint text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  update public.push_subscriptions
  set is_active = false, updated_at = now()
  where endpoint = p_endpoint and user_id = auth.uid()::text;
  return found;
end;
$$;

create or replace function public.claim_due_routine_notification_jobs(p_limit integer default 50)
returns setof public.routine_notification_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
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

create or replace function public.finish_routine_notification_job(
  p_job_id uuid,
  p_expected_scheduled_at timestamptz,
  p_next_notification_type text default null,
  p_next_scheduled_at timestamptz default null,
  p_next_dedupe_key text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  job_row public.routine_notification_jobs;
  occurrence_row public.daily_tasks;
  next_stage integer;
begin
  select * into job_row
  from public.routine_notification_jobs
  where id = p_job_id
  for update;

  if job_row.id is null
    or job_row.status <> 'processing'
    or job_row.scheduled_at <> p_expected_scheduled_at then
    return false;
  end if;

  select * into occurrence_row
  from public.daily_tasks
  where id = job_row.occurrence_id
  for update;

  update public.routine_notification_jobs
  set status = 'sent', sent_at = now(), last_notification_at = now(), updated_at = now()
  where id = job_row.id;

  if occurrence_row.status = 'pending'
    and p_next_notification_type is not null
    and p_next_scheduled_at is not null
    and p_next_dedupe_key is not null then
    next_stage := case p_next_notification_type when 'retry-10m' then 2 else 3 end;
    insert into public.routine_notification_jobs (
      user_id, pet_id, routine_id, routine_date, occurrence_id,
      scheduled_at, next_notification_at, notification_stage,
      notification_type, status, attempt_count, dedupe_key, updated_at
    ) values (
      job_row.user_id, job_row.pet_id, job_row.routine_id, job_row.routine_date, job_row.occurrence_id,
      p_next_scheduled_at, p_next_scheduled_at, next_stage,
      p_next_notification_type, 'pending', 0, p_next_dedupe_key, now()
    )
    on conflict (dedupe_key) where dedupe_key is not null do nothing;
  end if;
  return true;
end;
$$;

revoke all on function public.materialize_all_routine_notification_windows(date, integer) from public, anon, authenticated;
grant execute on function public.materialize_all_routine_notification_windows(date, integer) to service_role;
grant execute on function public.materialize_routine_notification_window(uuid, date, integer) to authenticated, service_role;
grant execute on function public.materialize_my_routine_notification_windows(date, integer) to authenticated;
grant execute on function public.refresh_routine_notification_window(uuid, date, integer) to authenticated, service_role;
grant execute on function public.cancel_occurrence_notification_jobs(uuid) to authenticated, service_role;
grant execute on function public.archive_care_plan(uuid) to authenticated;
grant execute on function public.sync_current_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.deactivate_current_push_subscription(text) to authenticated;
revoke all on function public.claim_due_routine_notification_jobs(integer) from public, anon, authenticated;
grant execute on function public.claim_due_routine_notification_jobs(integer) to service_role;
revoke all on function public.finish_routine_notification_job(uuid, timestamptz, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.finish_routine_notification_job(uuid, timestamptz, text, timestamptz, text) to service_role;

-- Daily rolling-window replenishment. The sender remains an external pg_cron
-- HTTP call because CRON_SECRET is stored outside migrations.
do $$
declare existing_job_id bigint;
begin
  select jobid into existing_job_id from cron.job where jobname = 'materialize-routine-notification-window';
  if existing_job_id is not null then perform cron.unschedule(existing_job_id); end if;
end;
$$;

select cron.schedule(
  'materialize-routine-notification-window',
  '5 15 * * *',
  $$select public.materialize_all_routine_notification_windows(null, 14);$$
);
