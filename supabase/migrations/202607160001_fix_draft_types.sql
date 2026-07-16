-- Keep the drafts table aligned with every in-app writing flow.
do $$
begin
  if to_regclass('public.drafts') is null then
    create table public.drafts (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references auth.users(id) on delete cascade,
      draft_type text not null,
      payload jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  end if;
end $$;

alter table public.drafts drop constraint if exists drafts_draft_type_check;
alter table public.drafts add constraint drafts_draft_type_check
  check (draft_type in ('pet', 'question', 'share_item', 'care_record', 'reminder', 'hospital_review', 'review'));

alter table public.drafts enable row level security;

drop policy if exists "drafts_crud_own" on public.drafts;
create policy "drafts_crud_own" on public.drafts
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists drafts_user_type_updated_at_idx
  on public.drafts(user_id, draft_type, updated_at desc);
