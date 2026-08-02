create table if not exists public.hospitals (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  name text not null,
  address text not null default '',
  road_address text,
  phone text,
  link text,
  lat double precision,
  lng double precision,
  categories text[] not null default '{}',
  supported_animals text[] not null default '{}',
  source text not null default 'manual',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.hospitals
  add column if not exists google_place_id text,
  add column if not exists last_collected_at timestamptz,
  add column if not exists opening_hours jsonb,
  add column if not exists current_opening_hours jsonb,
  add column if not exists is_open_now boolean,
  add column if not exists opening_hours_updated_at timestamptz;

create unique index if not exists hospitals_external_id_idx
  on public.hospitals(external_id);

create index if not exists hospitals_google_place_id_idx
  on public.hospitals(google_place_id)
  where google_place_id is not null;

alter table public.hospitals enable row level security;

drop policy if exists "hospitals_select_authenticated" on public.hospitals;
create policy "hospitals_select_authenticated" on public.hospitals
  for select to authenticated using (true);

create table if not exists public.hospital_collection_state (
  id boolean primary key default true check (id),
  collection_cycle text,
  next_region_index integer not null default 0,
  region_count integer not null default 0,
  lock_until timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  last_error text,
  updated_at timestamptz not null default now()
);

alter table public.hospital_collection_state enable row level security;

insert into public.hospital_collection_state (id)
values (true)
on conflict (id) do nothing;

create or replace function public.claim_hospital_collection_region(
  p_cycle text,
  p_region_count integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_index integer;
begin
  update public.hospital_collection_state
  set collection_cycle = p_cycle,
      next_region_index = 0,
      region_count = p_region_count,
      lock_until = null,
      started_at = now(),
      completed_at = null,
      last_error = null,
      updated_at = now()
  where id = true
    and collection_cycle is distinct from p_cycle;

  update public.hospital_collection_state
  set next_region_index = next_region_index + 1,
      lock_until = now() + interval '4 minutes',
      updated_at = now()
  where id = true
    and next_region_index < p_region_count
    and (lock_until is null or lock_until < now())
  returning next_region_index - 1 into claimed_index;

  if claimed_index is null then
    update public.hospital_collection_state
    set completed_at = coalesce(completed_at, now()),
        updated_at = now()
    where id = true
      and next_region_index >= p_region_count;
  end if;

  return claimed_index;
end;
$$;

create or replace function public.finish_hospital_collection_region(
  p_region_index integer,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.hospital_collection_state
  set next_region_index = case
        when p_error is not null and next_region_index = p_region_index + 1 then p_region_index
        else next_region_index
      end,
      lock_until = null,
      last_error = p_error,
      completed_at = case
        when p_error is null and next_region_index >= region_count then now()
        else completed_at
      end,
      updated_at = now()
  where id = true;
end;
$$;

revoke all on function public.claim_hospital_collection_region(text, integer) from public;
revoke all on function public.finish_hospital_collection_region(integer, text) from public;
grant execute on function public.claim_hospital_collection_region(text, integer) to service_role;
grant execute on function public.finish_hospital_collection_region(integer, text) to service_role;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'monthly-hospital-catalog-worker';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end;
$$;

select cron.schedule(
  'monthly-hospital-catalog-worker',
  '* 0-3 1 * *',
  $$
    select net.http_post(
      url := 'https://ckevydslbfxnspyfikeu.supabase.co/functions/v1/refresh-hospital-catalog',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := '{}'::jsonb
    );
  $$
);

comment on column public.hospitals.google_place_id is
  'Google Places place ID. Other Google Places content is not persisted long term.';

comment on table public.hospital_collection_state is
  'Tracks the low-concurrency monthly Naver hospital catalog collection cursor.';
