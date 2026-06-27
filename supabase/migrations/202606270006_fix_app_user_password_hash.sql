create extension if not exists pgcrypto with schema extensions;

create or replace function public.register_app_user(
  input_username text,
  input_password text,
  input_nickname text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  normalized_username text := lower(trim(input_username));
  new_user public.app_users;
begin
  if normalized_username !~ '^[a-z0-9_]{4,20}$' then
    raise exception '아이디는 영문 소문자, 숫자, 밑줄만 사용해서 4~20자로 입력해주세요.';
  end if;

  if length(input_password) < 6 then
    raise exception '비밀번호는 6자 이상이어야 합니다.';
  end if;

  if exists (select 1 from public.app_users where username = normalized_username) then
    raise exception '이미 사용 중인 아이디입니다.';
  end if;

  insert into public.app_users (username, nickname, password_hash)
  values (
    normalized_username,
    coalesce(nullif(trim(input_nickname), ''), normalized_username),
    extensions.crypt(input_password, extensions.gen_salt('bf'))
  )
  returning * into new_user;

  return jsonb_build_object(
    'id', new_user.id,
    'username', new_user.username,
    'nickname', new_user.nickname
  );
end;
$$;

create or replace function public.login_app_user(
  input_username text,
  input_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  normalized_username text := lower(trim(input_username));
  found_user public.app_users;
begin
  select *
  into found_user
  from public.app_users
  where username = normalized_username
  limit 1;

  if found_user.id is null or found_user.password_hash <> extensions.crypt(input_password, found_user.password_hash) then
    raise exception '아이디 또는 비밀번호를 확인해주세요.';
  end if;

  return jsonb_build_object(
    'id', found_user.id,
    'username', found_user.username,
    'nickname', found_user.nickname
  );
end;
$$;
