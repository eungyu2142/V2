-- Q&A likes are stored per user so another user's like never overwrites the author payload.
drop policy if exists "likes_select_all" on public.likes;
create policy "likes_select_all" on public.likes
for select using (true);

