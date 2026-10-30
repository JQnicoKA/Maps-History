-- Les policies lisent l'identité une seule fois.
--
-- `auth.uid()` écrit nu est réévalué pour chaque ligne examinée ;
-- `(select auth.uid())` est calculé une fois par requête. Le sens de chaque
-- policy ne change pas, seul son coût : voir
-- https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select
--
-- `alter policy` plutôt que `drop` puis `create` : la policy garde ses rôles et
-- sa commande, et n'existe à aucun moment sous une autre forme.
--
-- Les policies de `storage.objects` restent telles quelles : on n'y touche
-- qu'un fichier à la fois, l'advisor ne les signale pas.

alter policy "own events" on public.events
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy "own characters" on public.characters
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy "own trees" on public.trees
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy "own dismissals" on public.dismissed
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy "own drawn places" on public.drawn_places
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy "own drawn polities" on public.drawn_polities
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy "own hidden places" on public.hidden_places
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy "own hidden polities" on public.hidden_polities
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy "own event photos" on public.event_photos
  using (exists (
    select 1 from public.events e
    where e.id = event_photos.event_id and e.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.events e
    where e.id = event_photos.event_id and e.user_id = (select auth.uid())
  ));

alter policy "own character photos" on public.character_photos
  using (exists (
    select 1 from public.characters c
    where c.id = character_photos.character_id and c.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.characters c
    where c.id = character_photos.character_id and c.user_id = (select auth.uid())
  ));

alter policy "own event characters" on public.event_characters
  using (exists (
    select 1 from public.events e
    where e.id = event_characters.event_id and e.user_id = (select auth.uid())
  ))
  with check (
    exists (
      select 1 from public.events e
      where e.id = event_characters.event_id and e.user_id = (select auth.uid())
    )
    and exists (
      select 1 from public.characters c
      where c.id = event_characters.character_id and c.user_id = (select auth.uid())
    )
  );

alter policy "own tree links" on public.tree_links
  using (exists (
    select 1 from public.trees t
    where t.id = tree_links.tree_id and t.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.trees t
    where t.id = tree_links.tree_id and t.user_id = (select auth.uid())
  ));

alter policy "own tree members" on public.tree_members
  using (exists (
    select 1 from public.trees t
    where t.id = tree_members.tree_id and t.user_id = (select auth.uid())
  ))
  with check (
    exists (
      select 1 from public.trees t
      where t.id = tree_members.tree_id and t.user_id = (select auth.uid())
    )
    and (
      character_id is null
      or exists (
        select 1 from public.characters c
        where c.id = tree_members.character_id and c.user_id = (select auth.uid())
      )
    )
  );

alter policy "the library reviews" on public.review
  using (exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid()) and p.library
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid()) and p.library
  ));

-- Quatre clés étrangères sans index : supprimer un compte, un personnage ou un
-- membre d'arbre obligeait à parcourir toute la table qui les référence.
create index if not exists blocks_blocked_idx on public.blocks (blocked);
create index if not exists copies_user_id_idx on public.copies (user_id);
create index if not exists tree_links_child_id_idx on public.tree_links (child_id);
create index if not exists tree_members_character_id_idx on public.tree_members (character_id);
