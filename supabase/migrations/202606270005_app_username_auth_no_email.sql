drop function if exists public.is_username_available(text);
drop function if exists public.get_auth_email_for_username(text);
drop table if exists public.usernames;

create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  username text not null unique check (username ~ '^[a-z0-9_]{4,20}$'),
  nickname text not null,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_app_users_updated_at on public.app_users;
create trigger set_app_users_updated_at
before update on public.app_users
for each row execute function public.set_updated_at();

alter table public.app_users enable row level security;

create or replace function public.is_app_username_available(input_username text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.app_users
    where username = lower(trim(input_username))
  );
$$;

create or replace function public.register_app_user(
  input_username text,
  input_password text,
  input_nickname text
)
returns jsonb
language plpgsql
security definer
set search_path = public
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
    nullif(trim(input_nickname), ''),
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
set search_path = public
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

grant execute on function public.is_app_username_available(text) to anon, authenticated;
grant execute on function public.register_app_user(text, text, text) to anon, authenticated;
grant execute on function public.login_app_user(text, text) to anon, authenticated;
