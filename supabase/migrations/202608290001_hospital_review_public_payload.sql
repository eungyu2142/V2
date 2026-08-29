-- 병원 리뷰를 모든 로그인 사용자가 읽고 작성자 본인만 변경하도록 통일한다.
alter table public.hospital_reviews
  add column if not exists hospital_id text,
  add column if not exists hospital_name text not null default '',
  add column if not exists payload jsonb not null default '{}'::jsonb,
  add column if not exists images text[] not null default '{}';

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'hospital_reviews'
      and column_name = 'hospital_external_id'
  ) then
    execute 'update public.hospital_reviews set hospital_id = coalesce(hospital_id, hospital_external_id) where hospital_id is null';
    alter table public.hospital_reviews alter column hospital_external_id drop not null;
  end if;
end $$;

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

create index if not exists hospital_reviews_hospital_id_idx
on public.hospital_reviews(hospital_id, created_at desc);
