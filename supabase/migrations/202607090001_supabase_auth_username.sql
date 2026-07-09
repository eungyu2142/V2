-- Username UX backed by Supabase Auth. The synthetic email stays inside Auth.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  nickname text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists public.pets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  species text not null,
  category text not null,
  gender text not null default 'unknown',
  photo_url text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.care_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  record_date date not null default current_date,
  record_type text not null,
  memo text not null default '',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null,
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.share_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  area text not null default '',
  memo text not null default '',
  status text not null default 'open',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists profiles_username_unique_idx
  on public.profiles (lower(username))
  where deleted_at is null;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, nickname)
  values (
    new.id,
    lower(new.raw_user_meta_data ->> 'username'),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nickname'), ''), new.raw_user_meta_data ->> 'username')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

drop function if exists public.login_app_user(text, text);
drop function if exists public.register_app_user(text, text, text);
drop function if exists public.is_app_username_available(text);
drop table if exists public.app_users cascade;

alter table public.pets add column if not exists payload jsonb not null default '{}'::jsonb;
alter table public.community_posts add column if not exists payload jsonb not null default '{}'::jsonb;
alter table public.share_items add column if not exists payload jsonb not null default '{}'::jsonb;
alter table public.care_records add column if not exists payload jsonb not null default '{}'::jsonb;

alter table public.pets drop constraint if exists pets_category_check;
alter table public.pets drop constraint if exists pets_gender_check;
alter table public.pets add constraint pets_category_check
  check (category in ('reptile', 'amphibian', 'bird', 'rodent', 'other'));
alter table public.pets add constraint pets_gender_check
  check (gender in ('male', 'female', 'unknown'));
alter table public.care_records drop constraint if exists care_records_record_type_check;
alter table public.care_records add constraint care_records_record_type_check
  check (record_type in ('food', 'weight', 'shed', 'poop', 'cleaning', 'hospital', 'other'));

create table if not exists public.feeding_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.pets enable row level security;
alter table public.care_records enable row level security;
alter table public.community_posts enable row level security;
alter table public.share_items enable row level security;
alter table public.feeding_reminders enable row level security;
drop policy if exists "feeding_reminders_crud_own" on public.feeding_reminders;
create policy "feeding_reminders_crud_own" on public.feeding_reminders
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
for select to authenticated using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
for insert to authenticated with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "pets_crud_own" on public.pets;
create policy "pets_crud_own" on public.pets
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "care_records_crud_own" on public.care_records;
create policy "care_records_crud_own" on public.care_records
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "community_posts_select_all" on public.community_posts;
create policy "community_posts_select_all" on public.community_posts
for select to authenticated using (true);

drop policy if exists "community_posts_insert_own" on public.community_posts;
create policy "community_posts_insert_own" on public.community_posts
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "community_posts_update_own" on public.community_posts;
create policy "community_posts_update_own" on public.community_posts
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "community_posts_delete_own" on public.community_posts;
create policy "community_posts_delete_own" on public.community_posts
for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "share_items_select_all" on public.share_items;
create policy "share_items_select_all" on public.share_items
for select to authenticated using (true);

drop policy if exists "share_items_insert_own" on public.share_items;
create policy "share_items_insert_own" on public.share_items
for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "share_items_update_own" on public.share_items;
create policy "share_items_update_own" on public.share_items
for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "share_items_delete_own" on public.share_items;
create policy "share_items_delete_own" on public.share_items
for delete to authenticated using (auth.uid() = user_id);
