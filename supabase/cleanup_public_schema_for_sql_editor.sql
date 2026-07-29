-- Supabase SQL Editor용 public schema 정리 스크립트
-- 목적:
-- 1. 현재 앱에서 더 이상 쓰지 않는 legacy/빈 테이블을 삭제한다.
-- 2. 병원, 병원 리뷰, 좋아요 테이블은 앞으로 사용할 기준 구조로 다시 보장한다.
-- 3. 계정, 프로필, 마이 펫, 다이어리, Q&A, 임시저장, 병원 연결 기록은 유지한다.
--
-- 실행 전 확인:
-- - 이 스크립트는 DROP TABLE을 포함한다.
-- - share_items, app_* 계열, feeding_reminders, media_assets 데이터는 삭제된다.
-- - Supabase Dashboard에서 백업 또는 스냅샷을 확인한 뒤 실행한다.

begin;

-- 1. 명백한 legacy/미사용 테이블 삭제
drop table if exists public.app_likes cascade;
drop table if exists public.app_care_records cascade;
drop table if exists public.app_community_posts cascade;
drop table if exists public.app_post_comments cascade;
drop table if exists public.app_share_items cascade;
drop table if exists public.app_hospital_reviews cascade;
drop table if exists public.app_pets cascade;
drop table if exists public.app_users cascade;

-- 나눔 기능은 현재 앱 탭/흐름에서 제거된 상태라 정리한다.
drop table if exists public.share_items cascade;

-- feeding_reminders는 care_plans/daily_tasks 이전 구조의 fallback 테이블이다.
drop table if exists public.feeding_reminders cascade;

-- 현재 앱 코드에서 직접 사용하지 않는 media registry 테이블이다.
drop table if exists public.media_assets cascade;

-- 비어 있던 병원 테이블은 기준 구조로 다시 만든다.
drop table if exists public.hospitals cascade;

-- 2. 병원 기준 테이블 재생성
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

alter table public.hospitals enable row level security;

drop policy if exists "hospitals_select_authenticated" on public.hospitals;
create policy "hospitals_select_authenticated" on public.hospitals
for select to authenticated using (true);

create index if not exists hospitals_external_id_idx on public.hospitals(external_id);
create index if not exists hospitals_name_idx on public.hospitals(name);

-- 3. 병원 리뷰 테이블 보장
create table if not exists public.hospital_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  hospital_id text not null,
  hospital_name text not null default '',
  pet_id uuid references public.pets(id) on delete set null,
  rating integer not null default 5 check (rating between 1 and 5),
  visit_date date,
  diagnosis text,
  treatment text,
  medicine text,
  medicine_dose text,
  medicine_start_date date,
  medicine_end_date date,
  medicine_daily_count integer,
  medicine_instructions text,
  cost integer,
  tags text[] not null default '{}',
  body text not null default '',
  images text[] not null default '{}',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.hospital_reviews enable row level security;

drop policy if exists "hospital_reviews_select_all" on public.hospital_reviews;
create policy "hospital_reviews_select_all" on public.hospital_reviews
for select to authenticated using (true);

drop policy if exists "hospital_reviews_insert_own" on public.hospital_reviews;
create policy "hospital_reviews_insert_own" on public.hospital_reviews
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "hospital_reviews_update_own" on public.hospital_reviews;
create policy "hospital_reviews_update_own" on public.hospital_reviews
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "hospital_reviews_delete_own" on public.hospital_reviews;
create policy "hospital_reviews_delete_own" on public.hospital_reviews
for delete to authenticated using (auth.uid() = user_id);

create index if not exists hospital_reviews_hospital_id_idx on public.hospital_reviews(hospital_id, created_at desc);
create index if not exists hospital_reviews_user_id_idx on public.hospital_reviews(user_id, created_at desc);
create index if not exists hospital_reviews_pet_id_idx on public.hospital_reviews(pet_id);

-- 4. 좋아요 테이블 보장
-- 병원, 병원 리뷰, Q&A 글 좋아요를 한 테이블에서 관리한다.
create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('hospital', 'hospital_review', 'community_post')),
  target_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);

alter table public.likes enable row level security;

drop policy if exists "likes_select_own" on public.likes;
create policy "likes_select_own" on public.likes
for select to authenticated using (auth.uid() = user_id);

drop policy if exists "likes_insert_own" on public.likes;
create policy "likes_insert_own" on public.likes
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "likes_delete_own" on public.likes;
create policy "likes_delete_own" on public.likes
for delete to authenticated using (auth.uid() = user_id);

create index if not exists likes_target_idx on public.likes(target_type, target_id);

-- 5. 유지해야 하는 핵심 테이블 확인용 코멘트
-- 유지 대상:
-- auth.users, profiles, pets, care_records, care_plans, daily_tasks,
-- visit_records, medication_plans, community_posts, post_comments,
-- drafts, hospitals, hospital_reviews, likes

commit;
