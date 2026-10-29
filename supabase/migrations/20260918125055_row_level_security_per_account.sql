-- The prototype let anyone read and write everything. Now a signed-in reader
-- reaches their own rows and nothing else; a child row is reached through the
-- parent that owns it, so there is one rule per thing owned and no duplicated
-- notion of ownership.

drop policy if exists "prototype open access" on public.events;
create policy "own events" on public.events for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "prototype open access" on public.folders;
create policy "own folders" on public.folders for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "prototype open access" on public.characters;
create policy "own characters" on public.characters for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "prototype open access" on public.trees;
create policy "own trees" on public.trees for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Children of an event.
drop policy if exists "prototype open access" on public.event_photos;
create policy "own event photos" on public.event_photos for all to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.user_id = auth.uid()))
  with check (exists (select 1 from public.events e where e.id = event_id and e.user_id = auth.uid()));

-- Both ends are checked: filing an event in someone else's folder would be a
-- write to one's own row that reads another account's.
drop policy if exists "prototype open access" on public.event_folders;
create policy "own event folders" on public.event_folders for all to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.user_id = auth.uid()))
  with check (
    exists (select 1 from public.events e where e.id = event_id and e.user_id = auth.uid())
    and exists (select 1 from public.folders f where f.id = folder_id and f.user_id = auth.uid())
  );

drop policy if exists "prototype open access" on public.event_characters;
create policy "own event characters" on public.event_characters for all to authenticated
  using (exists (select 1 from public.events e where e.id = event_id and e.user_id = auth.uid()))
  with check (
    exists (select 1 from public.events e where e.id = event_id and e.user_id = auth.uid())
    and exists (select 1 from public.characters c where c.id = character_id and c.user_id = auth.uid())
  );

drop policy if exists "prototype open access" on public.character_photos;
create policy "own character photos" on public.character_photos for all to authenticated
  using (exists (select 1 from public.characters c where c.id = character_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.characters c where c.id = character_id and c.user_id = auth.uid()));

-- Children of a tree.
drop policy if exists "prototype open access" on public.tree_members;
create policy "own tree members" on public.tree_members for all to authenticated
  using (exists (select 1 from public.trees t where t.id = tree_id and t.user_id = auth.uid()))
  with check (
    exists (select 1 from public.trees t where t.id = tree_id and t.user_id = auth.uid())
    and exists (select 1 from public.characters c where c.id = character_id and c.user_id = auth.uid())
  );

drop policy if exists "prototype open access" on public.tree_links;
create policy "own tree links" on public.tree_links for all to authenticated
  using (exists (select 1 from public.trees t where t.id = tree_id and t.user_id = auth.uid()))
  with check (exists (select 1 from public.trees t where t.id = tree_id and t.user_id = auth.uid()));;
