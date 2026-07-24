alter table public.community_posts
  add column if not exists view_count bigint not null default 0;

create index if not exists community_posts_qna_view_count_idx
  on public.community_posts(view_count desc, created_at desc)
  where category = 'Q&A';

create or replace function public.increment_community_post_view(p_post_id uuid)
returns bigint
language sql
security definer
set search_path = public
as $$
  update public.community_posts
  set view_count = view_count + 1,
      updated_at = now()
  where id = p_post_id
    and category = 'Q&A'
  returning view_count;
$$;

grant execute on function public.increment_community_post_view(uuid) to authenticated;
