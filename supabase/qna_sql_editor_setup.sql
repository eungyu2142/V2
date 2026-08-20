-- ExoCare Q&A 통합 설정
-- Supabase SQL Editor에서 한 번 실행할 수 있는 재실행 안전 스크립트입니다.
-- 기존 데이터는 삭제하지 않습니다.

begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 1. Q&A 게시글 기반 테이블
-- 앱에서는 community_posts.category = 'Q&A'인 행을 Q&A 글로 사용합니다.
alter table public.community_posts
  add column if not exists view_count bigint not null default 0;

create index if not exists community_posts_qna_created_at_idx
  on public.community_posts(created_at desc)
  where category = 'Q&A';

create index if not exists community_posts_qna_view_count_idx
  on public.community_posts(view_count desc, created_at desc)
  where category = 'Q&A';

alter table public.community_posts enable row level security;

drop policy if exists "community_posts_select_all" on public.community_posts;
create policy "community_posts_select_all" on public.community_posts
for select to authenticated using (true);

drop policy if exists "community_posts_insert_own" on public.community_posts;
create policy "community_posts_insert_own" on public.community_posts
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "community_posts_update_own" on public.community_posts;
create policy "community_posts_update_own" on public.community_posts
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "community_posts_delete_own" on public.community_posts;
create policy "community_posts_delete_own" on public.community_posts
for delete to authenticated
using (auth.uid() = user_id);

-- 2. Q&A 댓글과 병원 첨부 스냅샷
create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.community_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  hospital_snapshot jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.post_comments
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists hospital_snapshot jsonb;

create index if not exists post_comments_post_id_created_at_idx
  on public.post_comments(post_id, created_at);

alter table public.post_comments enable row level security;

drop policy if exists "post_comments_select_all" on public.post_comments;
create policy "post_comments_select_all" on public.post_comments
for select to authenticated using (true);

drop policy if exists "post_comments_insert_own" on public.post_comments;
create policy "post_comments_insert_own" on public.post_comments
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "post_comments_update_own" on public.post_comments;
create policy "post_comments_update_own" on public.post_comments
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "post_comments_delete_own" on public.post_comments;
create policy "post_comments_delete_own" on public.post_comments
for delete to authenticated
using (auth.uid() = user_id);

drop trigger if exists set_post_comments_updated_at on public.post_comments;
create trigger set_post_comments_updated_at
before update on public.post_comments
for each row execute function public.set_updated_at();

comment on column public.post_comments.hospital_snapshot is
  'Q&A 댓글에 첨부한 병원 정보의 당시 스냅샷';

-- 3. 게시글·댓글 좋아요
create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null,
  target_id text not null,
  created_at timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);

create index if not exists likes_target_idx
  on public.likes(target_type, target_id);

create index if not exists likes_user_target_idx
  on public.likes(user_id, target_type, target_id);

alter table public.likes enable row level security;

-- 좋아요 수와 다른 사용자의 좋아요 상태를 읽을 수 있어야 합니다.
drop policy if exists "likes_select_own" on public.likes;
drop policy if exists "likes_select_all" on public.likes;
create policy "likes_select_all" on public.likes
for select to authenticated using (true);

drop policy if exists "likes_insert_own" on public.likes;
create policy "likes_insert_own" on public.likes
for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "likes_update_own" on public.likes;
create policy "likes_update_own" on public.likes
for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "likes_delete_own" on public.likes;
create policy "likes_delete_own" on public.likes
for delete to authenticated
using (auth.uid() = user_id);

-- 4. 상세 진입 조회수 증가
create or replace function public.increment_community_post_view(p_post_id uuid)
returns bigint
language sql
security definer
set search_path = public
as $$
  update public.community_posts
  set view_count = view_count + 1,
      updated_at = now()
  where id = p_post_id
    and category = 'Q&A'
  returning view_count;
$$;

grant execute on function public.increment_community_post_view(uuid) to authenticated;

-- 5. Q&A 사진 Storage
insert into storage.buckets (id, name, public)
values ('qna-images', 'qna-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "qna_images_read_authenticated" on storage.objects;
create policy "qna_images_read_authenticated"
on storage.objects for select to authenticated
using (bucket_id = 'qna-images');

drop policy if exists "qna_images_insert_own_folder" on storage.objects;
create policy "qna_images_insert_own_folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'qna-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "qna_images_update_own_folder" on storage.objects;
create policy "qna_images_update_own_folder"
on storage.objects for update to authenticated
using (
  bucket_id = 'qna-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'qna-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "qna_images_delete_own_folder" on storage.objects;
create policy "qna_images_delete_own_folder"
on storage.objects for delete to authenticated
using (
  bucket_id = 'qna-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

commit;

-- 실행 후 확인용 쿼리
-- select column_name, data_type
-- from information_schema.columns
-- where table_schema = 'public'
--   and table_name in ('community_posts', 'post_comments', 'likes')
-- order by table_name, ordinal_position;
--
-- select policyname, tablename
-- from pg_policies
-- where schemaname = 'public'
--   and tablename in ('community_posts', 'post_comments', 'likes');
