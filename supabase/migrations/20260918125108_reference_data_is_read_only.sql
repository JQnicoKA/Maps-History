-- The map itself — places, polities, territories — is not anybody's: it is
-- reference data loaded by the scripts in `scripts/`. Everyone may read it and
-- nobody may write it from a phone. The service role, which the loaders use,
-- bypasses these policies entirely.

drop policy if exists "prototype open access" on public.places;
create policy "read places" on public.places for select to anon, authenticated using (true);

drop policy if exists "prototype open access" on public.polities;
create policy "read polities" on public.polities for select to anon, authenticated using (true);

drop policy if exists "prototype open access" on public.polity_edges;
create policy "read polity edges" on public.polity_edges for select to anon, authenticated using (true);

drop policy if exists "prototype open access" on public.polity_fragments;
create policy "read polity fragments" on public.polity_fragments for select to anon, authenticated using (true);

drop policy if exists "prototype open access" on public.polity_wash;
create policy "read polity wash" on public.polity_wash for select to anon, authenticated using (true);

drop policy if exists "prototype open access" on public.territories;
create policy "read territories" on public.territories for select to anon, authenticated using (true);

drop policy if exists "prototype open access" on public.territory_fragments;
create policy "read territory fragments" on public.territory_fragments for select to anon, authenticated using (true);

-- Pictures live in one public bucket: readable by anyone holding the URL, as
-- they must be for an <Image> to load, but only a signed-in reader may add or
-- remove one.
drop policy if exists "prototype write event photos" on storage.objects;
drop policy if exists "prototype delete event photos" on storage.objects;
drop policy if exists "prototype read event photos" on storage.objects;

create policy "read event photos" on storage.objects for select to anon, authenticated
  using (bucket_id = 'event-photos');
create policy "write event photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'event-photos');
create policy "replace event photos" on storage.objects for update to authenticated
  using (bucket_id = 'event-photos') with check (bucket_id = 'event-photos');
create policy "delete event photos" on storage.objects for delete to authenticated
  using (bucket_id = 'event-photos');;
