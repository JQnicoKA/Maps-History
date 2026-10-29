-- Until now any signed-in reader could write or delete anywhere in the bucket:
-- the policies only asked which bucket, never whose file. A bucket has no
-- columns to hang ownership on, so the account is written into the path — every
-- object lives under `<user id>/…` — and these policies read that first segment.
--
-- Reading stays open: an <Image> loads a public URL, and the app has always
-- relied on that. What is protected here is writing over, and deleting,
-- somebody else's pictures.

drop policy if exists "write event photos" on storage.objects;
drop policy if exists "replace event photos" on storage.objects;
drop policy if exists "delete event photos" on storage.objects;

create policy "write own photos" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'event-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "replace own photos" on storage.objects for update to authenticated
  using (
    bucket_id = 'event-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'event-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "delete own photos" on storage.objects for delete to authenticated
  using (
    bucket_id = 'event-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );;
