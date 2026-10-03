-- Normalize pet species while keeping the legacy text columns during migration.
-- species_catalog becomes the canonical source; pets.species/category remain
-- compatibility mirrors for the current clients and existing payloads.

create table if not exists public.species_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  category text not null check (category in ('reptile', 'amphibian', 'bird', 'rodent', 'other')),
  profile_key text references public.species_care_profiles(profile_key) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category, name)
);

alter table public.species_catalog enable row level security;

drop policy if exists "species_catalog_read_authenticated" on public.species_catalog;
create policy "species_catalog_read_authenticated" on public.species_catalog
for select to authenticated using (true);

drop trigger if exists set_species_catalog_updated_at on public.species_catalog;
create trigger set_species_catalog_updated_at
before update on public.species_catalog
for each row execute function public.set_updated_at();

insert into public.species_catalog as catalog (name, category, profile_key)
select trim(label), category, profile_key
from public.species_care_profiles
where trim(label) <> ''
on conflict (category, name) do update
set profile_key = coalesce(catalog.profile_key, excluded.profile_key);

insert into public.species_catalog (name, category)
select distinct
  case when trim(species) = '' then '미등록' else trim(species) end,
  case
    when category in ('reptile', '파충류') then 'reptile'
    when category in ('amphibian', '양서류') then 'amphibian'
    when category in ('bird', '조류') then 'bird'
    when category in ('rodent', '설치류') then 'rodent'
    else 'other'
  end
from public.pets
on conflict (category, name) do nothing;

alter table public.pets
add column if not exists species_id uuid references public.species_catalog(id) on delete restrict;

update public.pets p
set species_id = s.id
from public.species_catalog s
where p.species_id is null
  and s.name = case when trim(p.species) = '' then '미등록' else trim(p.species) end
  and s.category = case
    when p.category in ('reptile', '파충류') then 'reptile'
    when p.category in ('amphibian', '양서류') then 'amphibian'
    when p.category in ('bird', '조류') then 'bird'
    when p.category in ('rodent', '설치류') then 'rodent'
    else 'other'
  end;

do $$
begin
  if exists (select 1 from public.pets where species_id is null) then
    raise exception 'Species normalization failed: one or more pets could not be matched.';
  end if;
end;
$$;

alter table public.pets alter column species_id set not null;

create index if not exists pets_user_species_id_idx
on public.pets (user_id, species_id);

create index if not exists pets_species_id_idx
on public.pets (species_id, id);

create or replace function public.sync_pet_species_reference()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_category text;
  resolved_species public.species_catalog%rowtype;
begin
  normalized_category := case
    when new.category in ('reptile', '파충류') then 'reptile'
    when new.category in ('amphibian', '양서류') then 'amphibian'
    when new.category in ('bird', '조류') then 'bird'
    when new.category in ('rodent', '설치류') then 'rodent'
    else 'other'
  end;

  if tg_op = 'UPDATE'
    and new.species_id is not distinct from old.species_id
    and (new.species is distinct from old.species or new.category is distinct from old.category) then
    new.species_id := null;
  end if;

  if new.species_id is not null then
    select * into resolved_species from public.species_catalog where id = new.species_id;
  else
    insert into public.species_catalog (name, category)
    values (case when trim(new.species) = '' then '미등록' else trim(new.species) end, normalized_category)
    on conflict (category, name) do update set name = excluded.name
    returning * into resolved_species;
  end if;

  if resolved_species.id is null then
    raise exception 'Unknown species reference: %', new.species_id;
  end if;

  new.species_id := resolved_species.id;
  new.species := resolved_species.name;
  new.category := resolved_species.category;
  return new;
end;
$$;

drop trigger if exists sync_pet_species_reference_before_write on public.pets;
create trigger sync_pet_species_reference_before_write
before insert or update of species_id, species, category on public.pets
for each row execute function public.sync_pet_species_reference();

create or replace view public.pets_with_species
with (security_invoker = true)
as
select
  p.*,
  s.name as species_name,
  s.category as species_category,
  s.profile_key as species_profile_key
from public.pets p
join public.species_catalog s on s.id = p.species_id;

grant select on public.species_catalog to authenticated;
grant select on public.pets_with_species to authenticated;
