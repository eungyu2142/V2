create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  species text not null,
  category text not null check (category in ('파충류', '양서류', '조류', '설치류', '기타')),
  gender text not null default '미구분' check (gender in ('미구분', '수컷', '암컷')),
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.care_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  record_date date not null default current_date,
  record_type text not null check (record_type in ('먹이', '무게', '탈피', '배변', '온욕', '청소', '병원', '기타')),
  memo text not null default '',
  amount numeric,
  unit text,
  photo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('Q&A', '케어팁', '일상', '병원후기')),
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.share_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  area text not null,
  memo text not null default '',
  status text not null default 'open' check (status in ('open', 'reserved', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hospital_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  hospital_external_id text not null,
  hospital_name text not null,
  rating int check (rating between 1 and 5),
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_pets_updated_at on public.pets;
create trigger set_pets_updated_at
before update on public.pets
for each row execute function public.set_updated_at();

drop trigger if exists set_care_records_updated_at on public.care_records;
create trigger set_care_records_updated_at
before update on public.care_records
for each row execute function public.set_updated_at();

drop trigger if exists set_community_posts_updated_at on public.community_posts;
create trigger set_community_posts_updated_at
before update on public.community_posts
for each row execute function public.set_updated_at();

drop trigger if exists set_share_items_updated_at on public.share_items;
create trigger set_share_items_updated_at
before update on public.share_items
for each row execute function public.set_updated_at();

drop trigger if exists set_hospital_reviews_updated_at on public.hospital_reviews;
create trigger set_hospital_reviews_updated_at
before update on public.hospital_reviews
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.pets enable row level security;
alter table public.care_records enable row level security;
alter table public.community_posts enable row level security;
alter table public.share_items enable row level security;
alter table public.hospital_reviews enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "pets_crud_own" on public.pets;
create policy "pets_crud_own" on public.pets
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "care_records_crud_own" on public.care_records;
create policy "care_records_crud_own" on public.care_records
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "community_posts_select_all" on public.community_posts;
create policy "community_posts_select_all" on public.community_posts
for select using (true);

drop policy if exists "community_posts_insert_own" on public.community_posts;
create policy "community_posts_insert_own" on public.community_posts
for insert with check (auth.uid() = user_id);

drop policy if exists "community_posts_update_own" on public.community_posts;
create policy "community_posts_update_own" on public.community_posts
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "community_posts_delete_own" on public.community_posts;
create policy "community_posts_delete_own" on public.community_posts
for delete using (auth.uid() = user_id);

drop policy if exists "share_items_select_all" on public.share_items;
create policy "share_items_select_all" on public.share_items
for select using (true);

drop policy if exists "share_items_insert_own" on public.share_items;
create policy "share_items_insert_own" on public.share_items
for insert with check (auth.uid() = user_id);

drop policy if exists "share_items_update_own" on public.share_items;
create policy "share_items_update_own" on public.share_items
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "share_items_delete_own" on public.share_items;
create policy "share_items_delete_own" on public.share_items
for delete using (auth.uid() = user_id);

drop policy if exists "hospital_reviews_select_all" on public.hospital_reviews;
create policy "hospital_reviews_select_all" on public.hospital_reviews
for select using (true);

drop policy if exists "hospital_reviews_insert_own" on public.hospital_reviews;
create policy "hospital_reviews_insert_own" on public.hospital_reviews
for insert with check (auth.uid() = user_id);

drop policy if exists "hospital_reviews_update_own" on public.hospital_reviews;
create policy "hospital_reviews_update_own" on public.hospital_reviews
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "hospital_reviews_delete_own" on public.hospital_reviews;
create policy "hospital_reviews_delete_own" on public.hospital_reviews
for delete using (auth.uid() = user_id);

create index if not exists pets_user_id_idx on public.pets(user_id);
create index if not exists care_records_user_pet_date_idx on public.care_records(user_id, pet_id, record_date desc);
create index if not exists community_posts_created_at_idx on public.community_posts(created_at desc);
create index if not exists share_items_created_at_idx on public.share_items(created_at desc);
create index if not exists hospital_reviews_hospital_external_id_idx on public.hospital_reviews(hospital_external_id);
