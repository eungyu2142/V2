alter table public.hospitals
  add column if not exists opening_hours jsonb,
  add column if not exists current_opening_hours jsonb,
  add column if not exists is_open_now boolean,
  add column if not exists opening_hours_updated_at timestamptz;

comment on column public.hospitals.opening_hours is
  'Google Places regularOpeningHours source payload.';

comment on column public.hospitals.current_opening_hours is
  'Google Places currentOpeningHours source payload including temporary or holiday changes.';

comment on column public.hospitals.is_open_now is
  'Point-in-time Google Places open status. Refresh instead of treating as a long-lived cache.';

comment on column public.hospitals.opening_hours_updated_at is
  'Time when opening-hours data was last refreshed.';
