alter table public.hospitals
  add column if not exists google_rating numeric,
  add column if not exists google_review_count integer,
  add column if not exists google_phone text,
  add column if not exists google_website text,
  add column if not exists google_place_id text,
  add column if not exists opening_hours jsonb,
  add column if not exists current_opening_hours jsonb,
  add column if not exists is_open_now boolean,
  add column if not exists places_last_updated timestamptz,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists hospitals_google_place_id_idx
  on public.hospitals (google_place_id)
  where google_place_id is not null;

create index if not exists hospitals_places_last_updated_idx
  on public.hospitals (places_last_updated)
  where places_last_updated is not null;

comment on column public.hospitals.google_rating is
  'Google Places에서 마지막으로 동기화한 평점';
comment on column public.hospitals.google_review_count is
  'Google Places에서 마지막으로 동기화한 평가 수';
comment on column public.hospitals.opening_hours is
  'Google Places 정규 영업시간 원본 객체';
comment on column public.hospitals.current_opening_hours is
  'Google Places 현재/임시 영업시간 원본 객체';
comment on column public.hospitals.is_open_now is
  'places_last_updated 시점의 Google Places 영업 여부 스냅샷';
comment on column public.hospitals.places_last_updated is
  'Google Places 상세정보를 마지막으로 정상 갱신한 시각';
