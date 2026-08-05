create table if not exists public.hospital_likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  hospital_key text not null,
  hospital_id text null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, hospital_key)
);

create index if not exists hospital_likes_user_created_idx
  on public.hospital_likes (user_id, created_at desc);

alter table public.hospital_likes enable row level security;

drop policy if exists "hospital_likes_select_own" on public.hospital_likes;
create policy "hospital_likes_select_own" on public.hospital_likes
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "hospital_likes_insert_own" on public.hospital_likes;
create policy "hospital_likes_insert_own" on public.hospital_likes
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "hospital_likes_update_own" on public.hospital_likes;
create policy "hospital_likes_update_own" on public.hospital_likes
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "hospital_likes_delete_own" on public.hospital_likes;
create policy "hospital_likes_delete_own" on public.hospital_likes
  for delete to authenticated
  using ((select auth.uid()) = user_id);
