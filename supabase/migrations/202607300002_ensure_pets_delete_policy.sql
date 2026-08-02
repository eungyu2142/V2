alter table public.pets enable row level security;

drop policy if exists "pets_delete_own" on public.pets;
create policy "pets_delete_own"
on public.pets
for delete
to authenticated
using (auth.uid() = user_id);
