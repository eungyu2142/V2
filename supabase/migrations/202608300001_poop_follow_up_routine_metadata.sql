alter table public.care_plans
  add column if not exists purpose text,
  add column if not exists source_record_id uuid references public.care_records(id) on delete set null;

alter table public.care_plans drop constraint if exists care_plans_purpose_check;
alter table public.care_plans add constraint care_plans_purpose_check
  check (purpose is null or purpose = 'poop_follow_up');

create index if not exists care_plans_poop_follow_up_idx
  on public.care_plans(user_id, pet_id, purpose)
  where purpose = 'poop_follow_up';
