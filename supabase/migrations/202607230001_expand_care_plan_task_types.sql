-- Expand care plan routine types beyond feed/water/cleaning.
-- Existing records are preserved; only the task_type check and completion mapping are widened.

alter table public.care_plans
  drop constraint if exists care_plans_task_type_check;

alter table public.care_plans
  add constraint care_plans_task_type_check check (
    task_type in (
      'feed',
      'water',
      'mist',
      'temperature',
      'humidity',
      'light',
      'cleaning',
      'partial_cleaning',
      'full_cleaning',
      'substrate_change',
      'bedding_tidy',
      'bedding_change',
      'chew_check',
      'wheel_check',
      'water_temperature',
      'water_quality',
      'cage_floor_cleaning',
      'cage_full_cleaning',
      'food_bowl_cleaning',
      'water_bowl_cleaning',
      'perch_cleaning',
      'play_interaction',
      'weight',
      'status_check',
      'custom'
    )
  );

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
    when task_row.task_type in (
      'cleaning',
      'partial_cleaning',
      'full_cleaning',
      'substrate_change',
      'bedding_tidy',
      'bedding_change',
      'cage_floor_cleaning',
      'cage_full_cleaning',
      'food_bowl_cleaning',
      'water_bowl_cleaning',
      'perch_cleaning'
    ) then 'cleaning'
    when task_row.task_type = 'weight' then 'weight'
    else 'other'
  end;

  record_memo := case task_row.task_type
    when 'feed' then '먹이 주기'
    when 'water' then '물 교체'
    when 'mist' then '분무'
    when 'temperature' then '온도 확인'
    when 'humidity' then '습도 확인'
    when 'light' then '조명 확인'
    when 'cleaning' then '청소'
    when 'partial_cleaning' then '부분 청소'
    when 'full_cleaning' then '전체 청소'
    when 'substrate_change' then '바닥재 교체'
    when 'bedding_tidy' then '베딩 부분 정리'
    when 'bedding_change' then '베딩 전체 교체'
    when 'chew_check' then '이갈이용품 확인'
    when 'wheel_check' then '쳇바퀴 확인'
    when 'water_temperature' then '수온 확인'
    when 'water_quality' then '수질 확인'
    when 'cage_floor_cleaning' then '케이지 바닥 청소'
    when 'cage_full_cleaning' then '케이지 전체 청소'
    when 'food_bowl_cleaning' then '먹이통 세척'
    when 'water_bowl_cleaning' then '물통 세척'
    when 'perch_cleaning' then '횃대 청소'
    when 'play_interaction' then '놀이·교감'
    when 'weight' then '체중 측정'
    when 'status_check' then '상태 확인'
    else '관리'
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
