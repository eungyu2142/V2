-- Keep a hospital recommendation attached to the comment independently of the flexible payload.
alter table public.post_comments
  add column if not exists hospital_snapshot jsonb;

comment on column public.post_comments.hospital_snapshot is
  'Hospital snapshot attached to a Q&A comment for stable display and map navigation.';
