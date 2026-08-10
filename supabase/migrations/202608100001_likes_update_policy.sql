-- Upsert needs UPDATE permission when the same user taps an already stored target.
drop policy if exists "likes_update_own" on public.likes;
create policy "likes_update_own" on public.likes
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
