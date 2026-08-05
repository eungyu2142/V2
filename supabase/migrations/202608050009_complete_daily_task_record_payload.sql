-- Keep simple check routine records readable through the same payload shape as detailed records.

create or replace function public.complete_daily_task(p_task_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  task_row public.daily_tasks;
  record_row public.care_records;
  plan_title text;
  record_type text;
  record_memo text;
  record_date date;
begin
  select *
    into task_row
    from public.daily_tasks
   where id = p_task_id
     and user_id = auth.uid()
   for update;

  if task_row.id is null then
    raise exception 'daily task not found';
  end if;

  if task_row.status = 'completed' then
    select *
      into record_row
      from public.care_records
     where daily_task_id = task_row.id;
    return to_jsonb(record_row);
  end if;

  if task_row.care_plan_id is not null then
    select title
      into plan_title
      from public.care_plans
     where id = task_row.care_plan_id
       and user_id = auth.uid();
  end if;

  record_type := case
    when task_row.task_type = 'feed' then 'food'
    when task_row.task_type in ('cleaning', 'partial_cleaning', 'full_cleaning', 'substrate_change', 'structure_cleaning', 'wall_wipe') then 'cleaning'
    when task_row.task_type = 'weight' then 'weight'
    when task_row.task_type = 'hospital' then 'hospital'
    else 'other'
  end;

  record_memo := case task_row.task_type
    when 'feed' then '먹이 주기'
    when 'water' then '물그릇 교체'
    when 'mist' then '분무'
    when 'temperature' then '온도 확인'
    when 'water_temperature' then '수온 확인'
    when 'humidity' then '습도 확인'
    when 'cleaning' then '청소'
    when 'partial_cleaning' then '부분 청소'
    when 'full_cleaning' then '전체 청소'
    when 'substrate_change' then '바닥재 교체'
    when 'structure_cleaning' then '구조물 세척'
    when 'wall_wipe' then '벽 닦기'
    when 'uvb_check' then 'UVB 확인'
    when 'water_quality' then '수질 확인'
    when 'filter_check' then '여과기 상태 확인'
    when 'weight' then '무게 측정'
    when 'medicine' then coalesce(nullif(plan_title, ''), '약')
    when 'hospital' then coalesce(nullif(plan_title, ''), '진료')
    else coalesce(nullif(plan_title, ''), '관리')
  end;
  record_date := timezone('Asia/Seoul', now())::date;

  update public.daily_tasks
     set status = 'completed',
         completed_at = now(),
         updated_at = now()
   where id = task_row.id;

  insert into public.care_records (
    user_id,
    pet_id,
    record_date,
    record_type,
    memo,
    payload,
    daily_task_id,
    occurred_at,
    scheduled_for,
    status
  )
  values (
    task_row.user_id,
    task_row.pet_id,
    record_date,
    record_type,
    record_memo,
    jsonb_build_object(
      'userId', task_row.user_id::text,
      'petId', task_row.pet_id::text,
      'type', record_type,
      'date', record_date::text,
      'memo', record_memo,
      'dailyTaskId', task_row.id::text,
      'scheduledFor', task_row.scheduled_date::text,
      'occurredAt', now(),
      'status', 'completed',
      'createdAt', now(),
      'taskType', task_row.task_type,
      'routineName', plan_title
    ),
    task_row.id,
    now(),
    task_row.scheduled_date,
    'completed'
  )
  on conflict (daily_task_id) do update
    set record_date = excluded.record_date,
        record_type = excluded.record_type,
        memo = excluded.memo,
        payload = excluded.payload,
        occurred_at = excluded.occurred_at,
        scheduled_for = excluded.scheduled_for,
        status = excluded.status
  returning * into record_row;

  return to_jsonb(record_row);
end;
$$;
