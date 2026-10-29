-- The same `folders` shape, so one card can read every kind.
--
-- A person's filing is the author's trees, and those stay names: a tree is
-- read on a canvas rather than in a card, and "Les arbres de leur auteur ;
-- les vôtres sont les vôtres" is the line the card already prints under them.
-- So `thing` is null here — the shape says "nowhere to go" rather than the
-- card having to know which kinds have somewhere.
create or replace function public.shared_character(wanted uuid)
returns jsonb
language sql
stable security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'id', c.id,
    'title', c.name,
    'type', 'character',
    'description', c.bio,
    'start_year', c.birth_year, 'start_month', c.birth_month,
    'start_day', c.birth_day, 'start_approx', c.birth_approx,
    'end_year', c.death_year, 'end_month', c.death_month,
    'end_day', c.death_day, 'end_approx', c.death_approx,
    'longitude', c.longitude, 'latitude', c.latitude,
    'author', pr.handle,
    'stars', c.stars,
    'mine', c.user_id = auth.uid(),
    'copied', exists (
      select 1 from public.copies k
      where k.kind = 'character' and k.source_id = c.id
        and k.user_id = auth.uid()
    ),
    'reported', exists (
      select 1 from public.reports r
      where r.kind = 'character' and r.source_id = c.id
        and r.reporter = auth.uid()
    ),
    'photos', coalesce((
      select jsonb_agg(
               jsonb_build_object('path', p.storage_path, 'source', p.source)
               order by p.position)
      from public.character_photos p where p.character_id = c.id
    ), '[]'::jsonb),
    'cast', coalesce((
      select jsonb_agg(e.title order by e.start_year)
      from public.event_characters ec
      join public.events e on e.id = ec.event_id
      where ec.character_id = c.id and e.shared
    ), '[]'::jsonb),
    'folders', coalesce((
      select jsonb_agg(
               jsonb_build_object('name', held.name, 'thing', null)
               order by held.name)
      from (
        select distinct t.name
        from public.tree_members m
        join public.trees t on t.id = m.tree_id
        where m.character_id = c.id and t.shared
      ) held
    ), '[]'::jsonb)
  )
  from public.characters c
  join public.profiles pr on pr.user_id = c.user_id
  where c.id = wanted
    and c.shared
    and not exists (
      select 1 from public.withheld w
      where w.kind = 'character' and w.source_id = c.id
    )
    and not exists (
      select 1 from public.blocks b
      where (b.user_id = auth.uid() and b.blocked = c.user_id)
         or (b.user_id = c.user_id and b.blocked = auth.uid())
    );
$$;;
