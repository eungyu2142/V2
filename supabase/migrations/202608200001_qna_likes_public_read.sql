-- Q&A cards need the aggregate like count, while writes remain owner-only.
drop policy if exists "likes_select_own" on public.likes;
drop policy if exists "likes_select_all" on public.likes;
create policy "likes_select_all" on public.likes
for select to authenticated using (true);
