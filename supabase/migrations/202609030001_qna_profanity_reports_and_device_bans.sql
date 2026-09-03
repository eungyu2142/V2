-- Automatic Q&A profanity warnings. Patterns derive from KoreanCursewordRegex (CC0-1.0).
-- https://github.com/curioustorvald/KoreanCursewordRegex
create table if not exists public.app_device_registrations (
  device_hash text not null, user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(), last_seen_at timestamptz not null default now(),
  primary key (device_hash, user_id), check (device_hash ~ '^[0-9a-f]{64}$')
);
create table if not exists public.banned_app_devices (
  device_hash text primary key, banned_user_id uuid, reason text not null default 'qna_profanity_warnings',
  created_at timestamptz not null default now(), check (device_hash ~ '^[0-9a-f]{64}$')
);
create table if not exists public.qna_profanity_warnings (
  id uuid primary key default gen_random_uuid(), user_id uuid not null,
  target_type text not null check (target_type in ('post', 'comment')), target_id uuid not null,
  matched_evidence text[] not null, created_at timestamptz not null default now(), unique (target_type, target_id)
);
create index if not exists qna_profanity_warnings_user_idx on public.qna_profanity_warnings(user_id, created_at);
alter table public.app_device_registrations enable row level security;
alter table public.banned_app_devices enable row level security;
alter table public.qna_profanity_warnings enable row level security;

create or replace function public.is_app_device_blocked(p_device_hash text)
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.banned_app_devices where device_hash = p_device_hash); $$;

create or replace function public.register_app_device(p_device_hash text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or p_device_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid device registration'; end if;
  if public.is_app_device_blocked(p_device_hash) then return false; end if;
  insert into public.app_device_registrations(device_hash, user_id) values (p_device_hash, auth.uid())
  on conflict (device_hash, user_id) do update set last_seen_at = now();
  return true;
end; $$;

create or replace function public.get_my_qna_warning_count()
returns integer language sql stable security definer set search_path = public
as $$ select count(*)::integer from public.qna_profanity_warnings where user_id = auth.uid(); $$;

create or replace function public.record_qna_profanity_warning()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid; v_target_type text; v_text text; v_evidence text[]; v_count integer;
  v_pattern text := '([시씨씪슈쓔쉬쉽쒸쓉][0-9 ]*[바발벌빠빡빨뻘파팔펄]|[섊좆좇졷좄좃좉졽썅춍봊]|[ㅈ조][0-9 ]*까|ㅅ[ ]*ㅣ[ ]*ㅂ[ ]*ㅏ[ ]*ㄹ?|[ㅅㅆ][0-9 ]*[ㄲㅅㅆㅂ]|[존좉좇][0-9 ]*나|[병븅][0-9 ]*[신딱]|미친[가-닣닥-힣]?|[염옘][0-9 ]*병|[지야][0-9 ]*랄|니[애에]미|[샊샛세쉐쉑새][ ]*[끼키퀴]|tlqkf|wls|ㅂ신|ㅅ발|ㅈ밥)';
begin
  if tg_table_name = 'community_posts' then
    if new.category <> 'Q&A' then return new; end if;
    v_user_id := new.user_id; v_target_type := 'post';
    v_text := lower(concat_ws(' ', new.title, new.body, new.payload->>'title', new.payload->>'body'));
  else
    v_user_id := new.user_id; v_target_type := 'comment';
    v_text := lower(concat_ws(' ', new.body, new.payload->>'body'));
  end if;
  select coalesce(array_agg(distinct matched[1]), '{}') into v_evidence
  from regexp_matches(coalesce(v_text, ''), v_pattern, 'g') as matched;
  if cardinality(v_evidence) = 0 then return new; end if;
  insert into public.qna_profanity_warnings(user_id, target_type, target_id, matched_evidence)
  values (v_user_id, v_target_type, new.id, v_evidence) on conflict (target_type, target_id) do nothing;
  select count(*)::integer into v_count from public.qna_profanity_warnings where user_id = v_user_id;
  if v_count >= 5 then
    insert into public.banned_app_devices(device_hash, banned_user_id)
      select device_hash, v_user_id from public.app_device_registrations where user_id = v_user_id
      on conflict (device_hash) do nothing;
    delete from auth.users where id = v_user_id;
  end if;
  return new;
end; $$;

drop trigger if exists record_qna_post_profanity_warning on public.community_posts;
create trigger record_qna_post_profanity_warning after insert or update of title, body, payload on public.community_posts
for each row execute function public.record_qna_profanity_warning();
drop trigger if exists record_qna_comment_profanity_warning on public.post_comments;
create trigger record_qna_comment_profanity_warning after insert or update of body, payload on public.post_comments
for each row execute function public.record_qna_profanity_warning();

revoke all on function public.is_app_device_blocked(text) from public;
revoke all on function public.register_app_device(text) from public;
revoke all on function public.get_my_qna_warning_count() from public;
grant execute on function public.is_app_device_blocked(text) to anon, authenticated;
grant execute on function public.register_app_device(text) to authenticated;
grant execute on function public.get_my_qna_warning_count() to authenticated;
