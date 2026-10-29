/**
 * One shared classeur, and the events in it, whole.
 *
 * A list of titles was all this gave, and a title is not enough to judge a
 * box by: the reader wants the dates, the pictures, the shape of the thing —
 * the same line the catalogue draws for an event when they search for one.
 * So the events come back in the catalogue's own row shape and the card draws
 * them with the very same component.
 *
 * Capped at fifty, oldest first. A card is a card.
 */
create or replace function public.shared_folder(wanted uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select jsonb_build_object(
    'id', f.id,
    'title', f.name,
    'type', 'folder',
    'note', (
      select case count(*)
        when 0 then 'vide'
        when 1 then '1 événement'
        else count(*) || ' événements'
      end
      from public.event_folders ef
      join public.events e on e.id = ef.event_id
      where ef.folder_id = f.id and e.shared
    ),
    'description', null,
    'start_year', (
      select min(e.start_year) from public.event_folders ef
      join public.events e on e.id = ef.event_id
      where ef.folder_id = f.id and e.shared
    ),
    'start_month', null, 'start_day', null, 'start_approx', false,
    'end_year', (
      select max(coalesce(e.end_year, e.start_year))
      from public.event_folders ef
      join public.events e on e.id = ef.event_id
      where ef.folder_id = f.id and e.shared
    ),
    'end_month', null, 'end_day', null, 'end_approx', false,
    'longitude', null, 'latitude', null,
    'author', pr.handle,
    'stars', f.stars,
    'mine', f.user_id = auth.uid(),
    'copied', exists (
      select 1 from public.copies c
      where c.kind = 'folder' and c.source_id = f.id and c.user_id = auth.uid()
    ),
    'reported', exists (
      select 1 from public.reports r
      where r.kind = 'folder' and r.source_id = f.id
        and r.reporter = auth.uid()
    ),
    'photos', case
      when f.photo_path is null then '[]'::jsonb
      else jsonb_build_array(
        jsonb_build_object('path', f.photo_path, 'source', null)
      )
    end,
    'cast', '[]'::jsonb,
    'folders', '[]'::jsonb,
    -- What is in the box, in the shape the catalogue already knows how to
    -- draw. `importance` rides along: it is the one thing a classeur says
    -- about an event that the event does not say about itself.
    'held', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', one.id,
                 'title', one.title,
                 'kind', one.kind,
                 'note', null,
                 'start_year', one.start_year,
                 'start_month', one.start_month,
                 'start_day', one.start_day,
                 'start_approx', one.start_approx,
                 'end_year', one.end_year,
                 'end_month', one.end_month,
                 'end_day', one.end_day,
                 'end_approx', one.end_approx,
                 'longitude', one.longitude,
                 'latitude', one.latitude,
                 'cover_path', one.cover_path,
                 'author', one.author,
                 'stars', one.stars,
                 'mine', one.mine,
                 'copied', one.copied,
                 'reported', one.reported,
                 'rank', 0
               )
               order by one.sort_key
             )
      from (
        select
          e.id, e.title, e.type::text as kind,
          e.start_year, e.start_month, e.start_day, e.start_approx,
          e.end_year, e.end_month, e.end_day, e.end_approx,
          e.longitude, e.latitude,
          (
            select p.storage_path from public.event_photos p
            where p.event_id = e.id order by p.position limit 1
          ) as cover_path,
          holder.handle as author,
          e.stars,
          e.user_id = auth.uid() as mine,
          exists (
            select 1 from public.copies c
            where c.kind = 'event' and c.source_id = e.id
              and c.user_id = auth.uid()
          ) as copied,
          exists (
            select 1 from public.reports r
            where r.kind = 'event' and r.source_id = e.id
              and r.reporter = auth.uid()
          ) as reported,
          e.from_key as sort_key
        from public.event_folders ef
        join public.events e on e.id = ef.event_id
        join public.profiles holder on holder.user_id = e.user_id
        where ef.folder_id = f.id and e.shared
        order by e.from_key
        limit 50
      ) one
    ), '[]'::jsonb)
  )
  from public.folders f
  join public.profiles pr on pr.user_id = f.user_id
  where f.id = wanted
    and f.shared
    and not exists (
      select 1 from public.withheld w
      where w.kind = 'folder' and w.source_id = f.id
    )
    and not exists (
      select 1 from public.blocks b
      where (b.user_id = auth.uid() and b.blocked = f.user_id)
         or (b.user_id = f.user_id and b.blocked = auth.uid())
    );
$function$;

revoke execute on function public.shared_folder(uuid) from public, anon;;
