-- Public bucket: photo URLs are read straight into <Image>, no signing round-trip.
insert into storage.buckets (id, name, public)
values ('event-photos', 'event-photos', true)
on conflict (id) do nothing;

-- TEMPORARY, same rationale as the table policies: no accounts yet.
create policy "prototype read event photos" on storage.objects
  for select to anon, authenticated using (bucket_id = 'event-photos');
create policy "prototype write event photos" on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'event-photos');
create policy "prototype delete event photos" on storage.objects
  for delete to anon, authenticated using (bucket_id = 'event-photos');;
