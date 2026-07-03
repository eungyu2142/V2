-- EXOCARE clean schema reset
-- This script intentionally drops the old mixed auth/app tables and rebuilds
-- the database around app_users, because this app does not use email auth.

create extension if not exists pgcrypto with schema extensions;

drop function if exists public.delete_app_share_item(uuid, uuid);
drop function if exists public.upsert_app_share_item(uuid, jsonb);
drop function if exists public.delete_app_community_post(uuid, uuid);
drop function if exists public.upsert_app_community_post(uuid, jsonb);
drop function if exists public.delete_app_pet(uuid, uuid);
drop function if exists public.upsert_app_pet(uuid, jsonb);
drop function if exists public.get_app_feature_data(uuid);
drop function if exists public.login_app_user(text, text);
drop function if exists public.register_app_user(text, text, text);
drop function if exists public.is_app_username_available(text);
drop function if exists public.is_username_available(text);
drop function if exists public.get_auth_email_for_username(text);

drop table if exists public.media_assets cascade;
drop table if exists public.drafts cascade;
drop table if exists public.likes cascade;
drop table if exists public.post_comments cascade;
drop table if exists public.app_share_items cascade;
drop table if exists public.app_community_posts cascade;
drop table if exists public.app_care_records cascade;
drop table if exists public.app_hospital_reviews cascade;
drop table if exists public.app_pets cascade;
drop table if exists public.share_items cascade;
drop table if exists public.community_posts cascade;
drop table if exists public.hospital_reviews cascade;
drop table if exists public.care_records cascade;
drop table if exists public.pets cascade;
drop table if exists public.profiles cascade;
drop table if exists public.usernames cascade;
drop table if exists public.app_users cascade;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.app_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique check (username ~ '^[a-z0-9_]{4,20}$'),
  nickname text not null,
  password_hash text not null,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create trigger set_app_users_updated_at
before update on public.app_users
for each row execute function public.set_updated_at();

create table public.app_pets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  name text not null,
  species text not null,
  animal_group text not null check (animal_group in ('reptile', 'bird', 'rodent', 'amphibian', 'other')),
  gender text not null check (gender in ('male', 'female', 'unknown')),
  photo_url text,
  weight numeric,
  birthday date,
  birthday_unknown boolean not null default false,
  adoption_date date,
  adoption_date_unknown boolean not null default false,
  memo text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_app_pets_updated_at
before update on public.app_pets
for each row execute function public.set_updated_at();

create table public.app_care_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  pet_id uuid not null references public.app_pets(id) on delete cascade,
  record_date date not null default current_date,
  record_type text not null check (record_type in ('food', 'weight', 'shed', 'poop', 'cleaning', 'hospital', 'other')),
  detail jsonb not null default '{}'::jsonb,
  memo text not null default '',
  photo_url text,
  draft boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_app_care_records_updated_at
before update on public.app_care_records
for each row execute function public.set_updated_at();

create table public.app_community_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  post_type text not null default 'qna' check (post_type in ('qna', 'community')),
  category text not null default 'qna',
  pet_id uuid references public.app_pets(id) on delete set null,
  title text not null,
  body text not null,
  image_urls text[] not null default '{}',
  draft boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_app_community_posts_updated_at
before update on public.app_community_posts
for each row execute function public.set_updated_at();

create table public.app_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.app_community_posts(id) on delete cascade,
  user_id uuid not null references public.app_users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_app_post_comments_updated_at
before update on public.app_post_comments
for each row execute function public.set_updated_at();

create table public.app_share_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  title text not null,
  category_group text not null default 'other',
  category_detail text not null default 'other',
  animal_group text,
  pet_id uuid references public.app_pets(id) on delete set null,
  animal_species text,
  area text not null default '',
  memo text not null default '',
  image_urls text[] not null default '{}',
  video_url text,
  draft boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_app_share_items_updated_at
before update on public.app_share_items
for each row execute function public.set_updated_at();

create table public.app_hospital_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  pet_id uuid references public.app_pets(id) on delete set null,
  hospital_external_id text not null,
  hospital_name text not null,
  visit_date date,
  treatment text,
  diagnosis text,
  vet_opinion text,
  cost int,
  prescribed_medicine text,
  rating int check (rating between 1 and 5),
  tags text[] not null default '{}',
  custom_tags text[] not null default '{}',
  body text not null default '',
  image_urls text[] not null default '{}',
  video_url text,
  receipt_url text,
  payment_verified boolean not null default false,
  draft boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_app_hospital_reviews_updated_at
before update on public.app_hospital_reviews
for each row execute function public.set_updated_at();

create table public.app_likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_users(id) on delete cascade,
  target_type text not null check (target_type in ('hospital', 'hospital_review', 'share_item', 'community_post', 'question')),
  target_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);

alter table public.app_users enable row level security;
alter table public.app_pets enable row level security;
alter table public.app_care_records enable row level security;
alter table public.app_community_posts enable row level security;
alter table public.app_post_comments enable row level security;
alter table public.app_share_items enable row level security;
alter table public.app_hospital_reviews enable row level security;
alter table public.app_likes enable row level security;

create index app_pets_user_created_idx on public.app_pets(user_id, created_at desc);
create index app_care_records_user_pet_date_idx on public.app_care_records(user_id, pet_id, record_date desc);
create index app_community_posts_created_idx on public.app_community_posts(created_at desc);
create index app_post_comments_post_created_idx on public.app_post_comments(post_id, created_at);
create index app_share_items_created_idx on public.app_share_items(created_at desc);
create index app_hospital_reviews_hospital_idx on public.app_hospital_reviews(hospital_external_id, created_at desc);
create index app_likes_user_target_idx on public.app_likes(user_id, target_type, target_id);

create or replace function public.is_app_username_available(input_username text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.app_users
    where username = lower(trim(input_username))
      and deleted_at is null
  );
$$;

create or replace function public.register_app_user(
  input_username text,
  input_password text,
  input_nickname text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_username text := lower(trim(input_username));
  new_user public.app_users;
begin
  if normalized_username !~ '^[a-z0-9_]{4,20}$' then
    raise exception '아이디는 영문 소문자, 숫자, 밑줄만 사용해서 4~20자로 입력해주세요.';
  end if;

  if length(input_password) < 6 then
    raise exception '비밀번호는 6자 이상이어야 합니다.';
  end if;

  if exists (select 1 from public.app_users where username = normalized_username and deleted_at is null) then
    raise exception '이미 사용 중인 아이디입니다.';
  end if;

  insert into public.app_users (username, nickname, password_hash)
  values (
    normalized_username,
    coalesce(nullif(trim(input_nickname), ''), normalized_username),
    extensions.crypt(input_password, extensions.gen_salt('bf'))
  )
  returning * into new_user;

  return jsonb_build_object(
    'id', new_user.id,
    'username', new_user.username,
    'nickname', new_user.nickname,
    'avatarUrl', new_user.avatar_url
  );
end;
$$;

create or replace function public.login_app_user(
  input_username text,
  input_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_username text := lower(trim(input_username));
  found_user public.app_users;
begin
  select *
  into found_user
  from public.app_users
  where username = normalized_username
    and deleted_at is null
  limit 1;

  if found_user.id is null or found_user.password_hash <> extensions.crypt(input_password, found_user.password_hash) then
    raise exception '아이디 또는 비밀번호를 확인해주세요.';
  end if;

  return jsonb_build_object(
    'id', found_user.id,
    'username', found_user.username,
    'nickname', found_user.nickname,
    'avatarUrl', found_user.avatar_url
  );
end;
$$;

create or replace function public.get_app_home_data(input_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'pets', coalesce((
      select jsonb_agg(to_jsonb(p) - 'user_id' order by p.created_at desc)
      from public.app_pets p
      where p.user_id = input_user_id
    ), '[]'::jsonb),
    'careRecords', coalesce((
      select jsonb_agg(to_jsonb(r) - 'user_id' order by r.record_date desc, r.created_at desc)
      from public.app_care_records r
      where r.user_id = input_user_id
    ), '[]'::jsonb),
    'communityPosts', coalesce((
      select jsonb_agg(to_jsonb(c) - 'user_id' order by c.created_at desc)
      from public.app_community_posts c
      where c.draft = false
    ), '[]'::jsonb),
    'shareItems', coalesce((
      select jsonb_agg(to_jsonb(s) - 'user_id' order by s.created_at desc)
      from public.app_share_items s
      where s.draft = false
    ), '[]'::jsonb)
  )
  where exists (select 1 from public.app_users where id = input_user_id and deleted_at is null);
$$;

grant execute on function public.is_app_username_available(text) to anon, authenticated;
grant execute on function public.register_app_user(text, text, text) to anon, authenticated;
grant execute on function public.login_app_user(text, text) to anon, authenticated;
grant execute on function public.get_app_home_data(uuid) to anon, authenticated;
