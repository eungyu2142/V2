create unique index if not exists daily_tasks_medication_plan_date_unique
  on public.daily_tasks(medication_plan_id, scheduled_date, occurrence_no)
  where medication_plan_id is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'daily_tasks_medication_plan_id_fkey'
  ) then
    alter table public.daily_tasks
      add constraint daily_tasks_medication_plan_id_fkey
      foreign key (medication_plan_id) references public.medication_plans(id) on delete cascade;
  end if;
end $$;

create or replace function public.complete_daily_task(p_task_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  task_row public.daily_tasks;
  record_row public.care_records;
  record_type text;
  record_memo text;
begin
  select * into task_row from public.daily_tasks where id = p_task_id and user_id = auth.uid() for update;
  if task_row.id is null then raise exception 'daily task not found'; end if;
  if task_row.status = 'completed' then
    select * into record_row from public.care_records where daily_task_id = task_row.id;
    return to_jsonb(record_row);
  end if;

  record_type := case
    when task_row.task_type = 'feed' then 'food'
    when task_row.task_type = 'cleaning' then 'cleaning'
    else 'other'
  end;
  record_memo := case
    when task_row.task_type = 'feed' then '먹이'
    when task_row.task_type = 'water' then '물 교체'
    when task_row.task_type = 'cleaning' then '청소'
    when task_row.task_type like 'medicine|%' then
      '약 · ' || split_part(task_row.task_type, '|', 2) || ' · ' || split_part(task_row.task_type, '|', 3)
    else task_row.task_type
  end;

  update public.daily_tasks set status = 'completed', completed_at = now(), updated_at = now() where id = task_row.id;
  insert into public.care_records (user_id, pet_id, record_date, record_type, memo, payload, daily_task_id, occurred_at, scheduled_for, status)
  values (task_row.user_id, task_row.pet_id, timezone('Asia/Seoul', now())::date, record_type, record_memo,
    jsonb_build_object('task_type', task_row.task_type, 'scheduled_date', task_row.scheduled_date),
    task_row.id, now(), task_row.scheduled_date, 'completed')
  returning * into record_row;
  return to_jsonb(record_row);
end;
$$;
