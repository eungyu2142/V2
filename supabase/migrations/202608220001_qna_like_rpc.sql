-- Store Q&A likes with the authenticated database user instead of trusting a client user id.
create or replace function public.set_app_like(
  p_target_type text,
  p_target_id text,
  p_liked boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if p_target_type not in ('hospital', 'hospital_review', 'share_item', 'community_post', 'question') then
    raise exception 'unsupported like target type' using errcode = '22023';
  end if;

  if p_liked then
    insert into public.likes (user_id, target_type, target_id)
    values (v_user_id, p_target_type, p_target_id)
    on conflict (user_id, target_type, target_id) do nothing;
  else
    delete from public.likes
    where user_id = v_user_id
      and target_type = p_target_type
      and target_id = p_target_id;
  end if;
end;
$$;

revoke all on function public.set_app_like(text, text, boolean) from public;
grant execute on function public.set_app_like(text, text, boolean) to authenticated;
