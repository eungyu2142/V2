alter table public.profiles
add column if not exists nickname text,
add column if not exists deleted_at timestamptz;

alter table public.pets
add column if not exists photo_url text,
add column if not exists weight numeric,
add column if not exists birthday date,
add column if not exists birthday_unknown boolean not null default false,
add column if not exists adoption_date date,
add column if not exists adoption_date_unknown boolean not null default false;

alter table public.care_records
add column if not exists details jsonb not null default '{}'::jsonb,
add column if not exists draft_id uuid;

alter table public.share_items
add column if not exists headline text,
add column if not exists item_group text check (item_group in ('먹이', '용품', '직접 작성')),
add column if not exists item_category text,
add column if not exists image_urls text[] not null default '{}',
add column if not exists video_url text;

alter table public.hospital_reviews
add column if not exists pet_id uuid references public.pets(id) on delete set null,
add column if not exists visit_date date,
add column if not exists diagnosis text,
add column if not exists treatment text,
add column if not exists vet_opinion text,
add column if not exists cost int,
add column if not exists prescribed_medicine text,
add column if not exists tags text[] not null default '{}',
add column if not exists custom_tags text[] not null default '{}',
add column if not exists image_urls text[] not null default '{}',
add column if not exists video_url text,
add column if not exists receipt_url text,
add column if not exists payment_verified boolean not null default false,
add column if not exists draft_id uuid;

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('hospital', 'hospital_review', 'share_item', 'community_post', 'question')),
  target_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);

create table if not exists public.drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  draft_type text not null check (draft_type in ('review', 'question', 'care_record', 'share_item')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  owner_type text not null check (owner_type in ('pet', 'care_record', 'hospital_review', 'share_item', 'community_post')),
  owner_id uuid,
  media_type text not null check (media_type in ('image', 'video', 'receipt')),
  url text not null,
  created_at timestamptz not null default now()
);

drop trigger if exists set_post_comments_updated_at on public.post_comments;
create trigger set_post_comments_updated_at
before update on public.post_comments
for each row execute function public.set_updated_at();

drop trigger if exists set_drafts_updated_at on public.drafts;
create trigger set_drafts_updated_at
before update on public.drafts
for each row execute function public.set_updated_at();

alter table public.post_comments enable row level security;
alter table public.likes enable row level security;
alter table public.drafts enable row level security;
alter table public.media_assets enable row level security;

drop policy if exists "post_comments_select_all" on public.post_comments;
create policy "post_comments_select_all" on public.post_comments
for select using (true);

drop policy if exists "post_comments_insert_own" on public.post_comments;
create policy "post_comments_insert_own" on public.post_comments
for insert with check (auth.uid() = user_id);

drop policy if exists "post_comments_update_own" on public.post_comments;
create policy "post_comments_update_own" on public.post_comments
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "post_comments_delete_own" on public.post_comments;
create policy "post_comments_delete_own" on public.post_comments
for delete using (auth.uid() = user_id);

drop policy if exists "likes_select_own" on public.likes;
create policy "likes_select_own" on public.likes
for select using (auth.uid() = user_id);

drop policy if exists "likes_insert_own" on public.likes;
create policy "likes_insert_own" on public.likes
for insert with check (auth.uid() = user_id);

drop policy if exists "likes_delete_own" on public.likes;
create policy "likes_delete_own" on public.likes
for delete using (auth.uid() = user_id);

drop policy if exists "drafts_crud_own" on public.drafts;
create policy "drafts_crud_own" on public.drafts
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "media_assets_crud_own" on public.media_assets;
create policy "media_assets_crud_own" on public.media_assets
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists post_comments_post_id_created_at_idx on public.post_comments(post_id, created_at);
create index if not exists likes_user_target_idx on public.likes(user_id, target_type, target_id);
create index if not exists drafts_user_type_updated_at_idx on public.drafts(user_id, draft_type, updated_at desc);
create index if not exists media_assets_owner_idx on public.media_assets(owner_type, owner_id);
