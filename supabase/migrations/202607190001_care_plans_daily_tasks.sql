-- Recurring care plans are not notifications. They create date-based tasks
-- that become records only when the user completes them.
create table if not exists public.care_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  task_type text not null check (task_type in ('feed', 'water', 'cleaning')),
  title text not null default '',
  repeat_days smallint[] not null default '{}',
  start_date date not null default (timezone('Asia/Seoul', now())::date),
  end_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint care_plans_repeat_days_check check (repeat_days <@ array[0,1,2,3,4,5,6]::smallint[]),
  constraint care_plans_date_range_check check (end_date is null or end_date >= start_date)
);

create table if not exists public.daily_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  care_plan_id uuid references public.care_plans(id) on delete cascade,
  medication_plan_id uuid,
  pet_id uuid not null references public.pets(id) on delete cascade,
  task_type text not null,
  scheduled_date date not null,
  occurrence_no smallint not null default 1,
  status text not null default 'pending' check (status in ('pending', 'completed', 'skipped')),
  completed_at timestamptz,
  skip_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_tasks_source_check check (care_plan_id is not null or medication_plan_id is not null)
);

create unique index if not exists daily_tasks_care_plan_date_unique
  on public.daily_tasks(care_plan_id, scheduled_date, occurrence_no)
  where care_plan_id is not null;
create index if not exists daily_tasks_user_pet_date_idx
  on public.daily_tasks(user_id, pet_id, scheduled_date, status);
alter table public.care_records add column if not exists daily_task_id uuid references public.daily_tasks(id) on delete set null;
alter table public.care_records add column if not exists occurred_at timestamptz;
alter table public.care_records add column if not exists scheduled_for date;
alter table public.care_records add column if not exists status text not null default 'manual';
alter table public.care_records add column if not exists photo_url text;
create unique index if not exists care_records_daily_task_unique
  on public.care_records(daily_task_id)
  where daily_task_id is not null;

create table if not exists public.visit_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  hospital_name text not null,
  visit_date date not null,
  medication_asset_id uuid,
  ocr_raw jsonb,
  status text not null default 'draft' check (status in ('draft', 'confirmed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.medication_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  visit_record_id uuid references public.visit_records(id) on delete set null,
  name text not null,
  dose text not null,
  start_date date not null,
  end_date date,
  daily_count smallint not null default 1 check (daily_count > 0),
  instructions text not null default '',
  verification_asset_id uuid,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  owner_type text not null default 'hospital_review',
  owner_id uuid,
  media_type text not null default 'image',
  url text not null default '',
  created_at timestamptz not null default now()
);

alter table public.media_assets add column if not exists pet_id uuid references public.pets(id) on delete cascade;
alter table public.media_assets add column if not exists purpose text not null default 'other';
alter table public.media_assets add column if not exists storage_path text;
alter table public.media_assets add column if not exists mime_type text;
alter table public.media_assets add column if not exists byte_size bigint;

alter table public.visit_records enable row level security;
alter table public.medication_plans enable row level security;
drop policy if exists "visit_records_crud_own" on public.visit_records;
create policy "visit_records_crud_own" on public.visit_records
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "medication_plans_crud_own" on public.medication_plans;
create policy "medication_plans_crud_own" on public.medication_plans
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.confirm_medication_plan(
  p_visit_record_id uuid,
  p_name text,
  p_dose text,
  p_start_date date,
  p_end_date date,
  p_daily_count smallint,
  p_instructions text,
  p_verification_asset_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  visit_row public.visit_records;
  plan_id uuid;
begin
  if p_verification_asset_id is null then raise exception 'medication verification is required'; end if;
  if p_visit_record_id is not null then
    select * into visit_row from public.visit_records where id = p_visit_record_id and user_id = auth.uid() for update;
    if visit_row.id is null then raise exception 'visit record not found'; end if;
    update public.visit_records set status = 'confirmed', updated_at = now() where id = visit_row.id;
  end if;
  insert into public.medication_plans (user_id, pet_id, visit_record_id, name, dose, start_date, end_date, daily_count, instructions, verification_asset_id)
  values (auth.uid(), visit_row.pet_id, p_visit_record_id, trim(p_name), trim(p_dose), p_start_date, p_end_date, p_daily_count, coalesce(p_instructions, ''), p_verification_asset_id)
  returning id into plan_id;
  return plan_id;
end;
$$;

alter table public.care_plans enable row level security;
alter table public.daily_tasks enable row level security;

drop policy if exists "care_plans_crud_own" on public.care_plans;
create policy "care_plans_crud_own" on public.care_plans
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "daily_tasks_crud_own" on public.daily_tasks;
create policy "daily_tasks_crud_own" on public.daily_tasks
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

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
      if extract(dow from current_date_value)::smallint = any(plan_row.repeat_days) then
        insert into public.daily_tasks (user_id, care_plan_id, pet_id, task_type, scheduled_date, occurrence_no)
        values (plan_row.user_id, plan_row.id, plan_row.pet_id, plan_row.task_type, current_date_value, 1)
        on conflict do nothing;
        inserted_count := inserted_count + 1;
      end if;
      current_date_value := current_date_value + 1;
    end loop;
  end loop;
  return inserted_count;
end;
$$;

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

  record_type := case task_row.task_type when 'feed' then 'food' when 'cleaning' then 'cleaning' else 'other' end;
  record_memo := case task_row.task_type when 'feed' then '먹이' when 'water' then '물 교체' else '청소' end;
  update public.daily_tasks set status = 'completed', completed_at = now(), updated_at = now() where id = task_row.id;
  insert into public.care_records (user_id, pet_id, record_date, record_type, memo, payload, daily_task_id, occurred_at, scheduled_for, status)
  values (task_row.user_id, task_row.pet_id, timezone('Asia/Seoul', now())::date, record_type, record_memo,
    jsonb_build_object('task_type', task_row.task_type, 'scheduled_date', task_row.scheduled_date),
    task_row.id, now(), task_row.scheduled_date, 'completed')
  returning * into record_row;
  return to_jsonb(record_row);
end;
$$;

create or replace function public.undo_daily_task(p_task_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from public.care_records where daily_task_id = p_task_id and user_id = auth.uid();
  update public.daily_tasks set status = 'pending', completed_at = null, updated_at = now()
  where id = p_task_id and user_id = auth.uid();
end;
$$;

create or replace function public.skip_daily_task(p_task_id uuid, p_reason text default null)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.daily_tasks set status = 'skipped', skip_reason = p_reason, updated_at = now()
  where id = p_task_id and user_id = auth.uid();
end;
$$;
