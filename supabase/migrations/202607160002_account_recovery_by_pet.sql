create extension if not exists pgcrypto with schema extensions;

create or replace function public.find_username_by_pet(
  input_nickname text,
  input_pet_name text
)
returns text
language sql
security definer
set search_path = public
as $$
  select p.username
  from public.profiles p
  where p.deleted_at is null
    and p.nickname = trim(input_nickname)
    and exists (
      select 1
      from public.pets pet
      where pet.user_id = p.id
        and pet.name = trim(input_pet_name)
    )
  order by p.created_at asc
  limit 1;
$$;

create or replace function public.reset_password_by_pet(
  input_username text,
  input_pet_name text,
  input_new_password text
)
returns boolean
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  matched_user_id uuid;
begin
  if length(input_new_password) < 6 then
    return false;
  end if;

  select p.id
    into matched_user_id
  from public.profiles p
  where p.deleted_at is null
    and lower(p.username) = lower(trim(input_username))
    and exists (
      select 1
      from public.pets pet
      where pet.user_id = p.id
        and pet.name = trim(input_pet_name)
    )
  limit 1;

  if matched_user_id is null then
    return false;
  end if;

  update auth.users
  set encrypted_password = crypt(input_new_password, gen_salt('bf')),
      updated_at = now()
  where id = matched_user_id;

  return found;
end;
$$;

revoke all on function public.find_username_by_pet(text, text) from public, anon, authenticated;
revoke all on function public.reset_password_by_pet(text, text, text) from public, anon, authenticated;

grant execute on function public.find_username_by_pet(text, text) to anon, authenticated;
grant execute on function public.reset_password_by_pet(text, text, text) to anon, authenticated;
