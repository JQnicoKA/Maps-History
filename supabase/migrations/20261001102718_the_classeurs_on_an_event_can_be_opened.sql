-- "Rangé par son auteur dans" becomes somewhere to go.
--
-- It used to be a list of names, and a name is a dead end: a reader who sees
-- that an event belongs to "Guerres de religion" learns that a classeur
-- exists and has no way to reach it. Now each entry carries the whole
-- classeur row, in the shape the catalogue already knows how to draw — so the
-- card can offer "Voir le classeur", and from there the reader can take the
-- whole box rather than the one event they happened to land on.
--
-- **Only the classeurs that are themselves in the chronicle are named.** This
-- changes what the card shows, deliberately: withdrawing a classeur from the
-- chronicle promises it "n'appartient qu'à vous", and printing its name on
-- every shared event inside it broke that promise. A private classeur is now
-- silent rather than named-but-unreachable.
--
-- The key stays `folders` — the element shape is what changed, and renaming
-- it would mean rewriting three doors that only say `'folders', '[]'`.
create or replace function public.shared_event(wanted uuid)
returns jsonb
language sql
stable security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'id', e.id,
    'title', e.title,
    'type', e.type::text,
    'description', e.description,
    'start_year', e.start_year, 'start_month', e.start_month,
    'start_day', e.start_day, 'start_approx', e.start_approx,
    'end_year', e.end_year, 'end_month', e.end_month,
    'end_day', e.end_day, 'end_approx', e.end_approx,
    'longitude', e.longitude, 'latitude', e.latitude,
    'author', pr.handle,
    'stars', e.stars,
    'mine', e.user_id = auth.uid(),
    'copied', exists (
      select 1 from public.copies c
      where c.kind = 'event' and c.source_id = e.id and c.user_id = auth.uid()
    ),
    'reported', exists (
      select 1 from public.reports r
      where r.kind = 'event' and r.source_id = e.id and r.reporter = auth.uid()
    ),
    'photos', coalesce((
      select jsonb_agg(
               jsonb_build_object('path', p.storage_path, 'source', p.source)
               order by p.position)
      from public.event_photos p where p.event_id = e.id
    ), '[]'::jsonb),
    'cast', coalesce((
      select jsonb_agg(ch.name order by ch.name)
      from public.event_characters ec
      join public.characters ch on ch.id = ec.character_id
      where ec.event_id = e.id
    ), '[]'::jsonb),
    -- The classeurs it was filed in, each one whole enough to be opened.
    -- `name` rides alongside the row so the card has something to print
    -- without unpacking it, and so a kind whose filing cannot be opened —
    -- see `shared_character` — can answer with names and a null.
    'folders', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'name', box.title,
                 'thing', jsonb_build_object(
                   'id', box.id,
                   'title', box.title,
                   'kind', 'folder',
                   'note', box.note,
                   'start_year', box.start_year,
                   'start_month', null, 'start_day', null,
                   'start_approx', false,
                   'end_year', box.end_year,
                   'end_month', null, 'end_day', null, 'end_approx', false,
                   'longitude', null, 'latitude', null,
                   'cover_path', box.cover_path,
                   'author', box.author,
                   'stars', box.stars,
                   'mine', box.mine,
                   'copied', box.copied,
                   'reported', box.reported,
                   'rank', 0
                 )
               )
               order by box.title
             )
      from (
        select
          f.id, f.name as title, f.photo_path as cover_path, f.stars,
          holder.handle as author,
          f.user_id = auth.uid() as mine,
          (
            select case count(*)
              when 0 then 'vide'
              when 1 then '1 événement'
              else count(*) || ' événements'
            end
            from public.event_folders inner_ef
            join public.events inner_e on inner_e.id = inner_ef.event_id
            where inner_ef.folder_id = f.id and inner_e.shared
          ) as note,
          (
            select min(inner_e.start_year)
            from public.event_folders inner_ef
            join public.events inner_e on inner_e.id = inner_ef.event_id
            where inner_ef.folder_id = f.id and inner_e.shared
          ) as start_year,
          (
            select max(coalesce(inner_e.end_year, inner_e.start_year))
            from public.event_folders inner_ef
            join public.events inner_e on inner_e.id = inner_ef.event_id
            where inner_ef.folder_id = f.id and inner_e.shared
          ) as end_year,
          exists (
            select 1 from public.copies c
            where c.kind = 'folder' and c.source_id = f.id
              and c.user_id = auth.uid()
          ) as copied,
          exists (
            select 1 from public.reports r
            where r.kind = 'folder' and r.source_id = f.id
              and r.reporter = auth.uid()
          ) as reported
        from public.event_folders ef
        join public.folders f on f.id = ef.folder_id
        join public.profiles holder on holder.user_id = f.user_id
        where ef.event_id = e.id
          and f.shared
          -- Withdrawn on its own account: moderation reaches a classeur
          -- without touching the events inside it. No block check here —
          -- a classeur belongs to the same author as the event, and the
          -- event got through, so that question is already settled.
          and not exists (
            select 1 from public.withheld w
            where w.kind = 'folder' and w.source_id = f.id
          )
      ) box
    ), '[]'::jsonb)
  )
  from public.events e
  join public.profiles pr on pr.user_id = e.user_id
  where e.id = wanted
    and e.shared
    and not exists (
      select 1 from public.withheld w
      where w.kind = 'event' and w.source_id = e.id
    )
    and not exists (
      select 1 from public.blocks b
      where (b.user_id = auth.uid() and b.blocked = e.user_id)
         or (b.user_id = e.user_id and b.blocked = auth.uid())
    );
$$;;
