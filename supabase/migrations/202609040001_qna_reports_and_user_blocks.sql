create table if not exists public.qna_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  target_user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment')),
  target_id uuid not null,
  reason text not null check (reason in ('스팸/광고', '욕설/괴롭힘', '개인정보 노출', '위험하거나 부적절한 사육 정보', '기타')),
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);

create table if not exists public.qna_user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_user_id),
  check (blocker_id <> blocked_user_id)
);

alter table public.qna_reports enable row level security;
alter table public.qna_user_blocks enable row level security;
create policy "qna_user_blocks_select_own" on public.qna_user_blocks for select using (blocker_id = auth.uid());

create or replace function public.resolve_qna_target_user(p_target_type text, p_target_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_user_id uuid;
begin
  if p_target_type = 'post' then select user_id into v_user_id from public.community_posts where id = p_target_id;
  elsif p_target_type = 'comment' then select user_id into v_user_id from public.post_comments where id = p_target_id;
  else raise exception 'invalid target type'; end if;
  if v_user_id is null then raise exception 'content not found'; end if;
  return v_user_id;
end; $$;

create or replace function public.submit_qna_report(p_target_type text, p_target_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_target_user uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_reason not in ('스팸/광고', '욕설/괴롭힘', '개인정보 노출', '위험하거나 부적절한 사육 정보', '기타') then raise exception 'invalid reason'; end if;
  v_target_user := public.resolve_qna_target_user(p_target_type, p_target_id);
  if v_target_user = auth.uid() then raise exception 'cannot report own content'; end if;
  insert into public.qna_reports(reporter_id, target_user_id, target_type, target_id, reason)
  values (auth.uid(), v_target_user, p_target_type, p_target_id, p_reason)
  on conflict (reporter_id, target_type, target_id) do update set reason = excluded.reason, created_at = now();
end; $$;

create or replace function public.block_qna_user(p_target_type text, p_target_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_target_user uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  v_target_user := public.resolve_qna_target_user(p_target_type, p_target_id);
  if v_target_user = auth.uid() then raise exception 'cannot block self'; end if;
  insert into public.qna_user_blocks(blocker_id, blocked_user_id) values (auth.uid(), v_target_user) on conflict do nothing;
end; $$;

revoke all on function public.resolve_qna_target_user(text, uuid) from public;
revoke all on function public.submit_qna_report(text, uuid, text) from public;
revoke all on function public.block_qna_user(text, uuid) from public;
grant execute on function public.submit_qna_report(text, uuid, text) to authenticated;
grant execute on function public.block_qna_user(text, uuid) to authenticated;
