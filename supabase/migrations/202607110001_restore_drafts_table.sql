create table if not exists public.drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  draft_type text not null check (draft_type in ('review', 'question', 'care_record', 'share_item')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.drafts add column if not exists payload jsonb not null default '{}'::jsonb;
alter table public.drafts add column if not exists created_at timestamptz not null default now();
alter table public.drafts add column if not exists updated_at timestamptz not null default now();

alter table public.drafts enable row level security;

drop policy if exists "drafts_crud_own" on public.drafts;
create policy "drafts_crud_own" on public.drafts
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists drafts_user_type_updated_at_idx on public.drafts(user_id, draft_type, updated_at desc);
