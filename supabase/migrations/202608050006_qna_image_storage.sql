-- Q&A photos are public previews, while writes and deletes remain owner-only.
insert into storage.buckets (id, name, public)
values ('qna-images', 'qna-images', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "qna_images_read_authenticated" on storage.objects;
create policy "qna_images_read_authenticated"
on storage.objects for select
to authenticated
using (bucket_id = 'qna-images');

drop policy if exists "qna_images_insert_own_folder" on storage.objects;
create policy "qna_images_insert_own_folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'qna-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "qna_images_update_own_folder" on storage.objects;
create policy "qna_images_update_own_folder"
on storage.objects for update
to authenticated
using (
  bucket_id = 'qna-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'qna-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "qna_images_delete_own_folder" on storage.objects;
create policy "qna_images_delete_own_folder"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'qna-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
