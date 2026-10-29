/**
 * One shared event, whole — what the card shows before anybody copies it.
 *
 * The same door as the search and the same three rules: shared only, no
 * account taken as an argument, nothing about the author but their name. The
 * cast and the folders come with it as plain names: a reader looking at
 * somebody else's event wants to know who is in it, not the identifiers of
 * rows they will never hold.
 */
create or replace function public.shared_event(wanted uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
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
    'photos', coalesce((
      select jsonb_agg(
               jsonb_build_object('path', p.storage_path, 'source', p.source)
               order by p.position
             )
      from public.event_photos p where p.event_id = e.id
    ), '[]'::jsonb),
    'cast', coalesce((
      select jsonb_agg(ch.name order by ch.name)
      from public.event_characters ec
      join public.characters ch on ch.id = ec.character_id
      where ec.event_id = e.id
    ), '[]'::jsonb),
    'folders', coalesce((
      select jsonb_agg(f.name order by f.name)
      from public.event_folders ef
      join public.folders f on f.id = ef.folder_id
      where ef.event_id = e.id
    ), '[]'::jsonb)
  )
  from public.events e
  join public.profiles pr on pr.user_id = e.user_id
  where e.id = wanted and e.shared;
$function$;

/**
 * Takes a copy of somebody's event into the caller's collection.
 *
 * What comes with it, and what does not:
 *
 * - **The people.** An event with no cast is half an event, so the characters
 *   it names are copied too — unless this reader already has them, which is
 *   what `origin_id` is for: copying two events about Clovis leaves one
 *   Clovis, not two.
 * - **The pictures' rows**, pointing at the author's files for a moment. The
 *   application duplicates the files afterwards and rewrites these paths, so
 *   a copy survives the original being deleted. Doing it here is impossible:
 *   storage is not reachable from SQL.
 * - **Not the folders.** Filing is the reader's own way of thinking about
 *   their collection; arriving with somebody else's classeurs would be an
 *   opinion nobody asked for. The names are on the card, to be reused or not.
 *
 * The copy is **not shared**. One Marignan in the catalogue with two hundred
 * stars is a chronicle; two hundred Marignans with one star each is a hall of
 * mirrors. Reversing that is a deliberate act, on the card.
 */
create or replace function public.copy_event(wanted uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  me uuid := auth.uid();
  source public.events%rowtype;
  made uuid;
  character_row record;
  already uuid;
  mine_now uuid;
begin
  if me is null then
    raise exception 'Il faut être connecté.';
  end if;

  select * into source from public.events e where e.id = wanted and e.shared;
  if not found then
    raise exception 'Cet événement n''est plus partagé.';
  end if;
  if source.user_id = me then
    raise exception 'Cet événement est déjà le vôtre.';
  end if;

  insert into public.events (
    user_id, title, description, type,
    start_year, start_month, start_day, start_approx,
    end_year, end_month, end_day, end_approx,
    longitude, latitude, shared, origin_id
  ) values (
    me, source.title, source.description, source.type,
    source.start_year, source.start_month, source.start_day, source.start_approx,
    source.end_year, source.end_month, source.end_day, source.end_approx,
    source.longitude, source.latitude, false, source.id
  ) returning id into made;

  insert into public.event_photos (event_id, storage_path, position, source)
  select made, p.storage_path, p.position, p.source
  from public.event_photos p
  where p.event_id = source.id;

  for character_row in
    select ch.*
    from public.event_characters ec
    join public.characters ch on ch.id = ec.character_id
    where ec.event_id = source.id
  loop
    -- Already taken, under either name: the copy this reader made of it, or
    -- the original if the character was theirs to begin with.
    select c.id into already
    from public.characters c
    where c.user_id = me
      and (c.origin_id = character_row.id or c.id = character_row.id)
    limit 1;

    if already is null then
      insert into public.characters (
        user_id, name, bio,
        birth_year, birth_month, birth_day, birth_approx,
        death_year, death_month, death_day, death_approx,
        longitude, latitude, shared, origin_id
      ) values (
        me, character_row.name, character_row.bio,
        character_row.birth_year, character_row.birth_month,
        character_row.birth_day, character_row.birth_approx,
        character_row.death_year, character_row.death_month,
        character_row.death_day, character_row.death_approx,
        character_row.longitude, character_row.latitude, false, character_row.id
      ) returning id into mine_now;

      insert into public.character_photos (character_id, storage_path, position, source)
      select mine_now, cp.storage_path, cp.position, cp.source
      from public.character_photos cp
      where cp.character_id = character_row.id;
    else
      mine_now := already;
    end if;

    insert into public.event_characters (event_id, character_id)
    values (made, mine_now)
    on conflict do nothing;
  end loop;

  insert into public.copies (kind, source_id, user_id)
  values ('event', source.id, me)
  on conflict do nothing;

  return made;
end;
$function$;

revoke execute on function public.shared_event(uuid) from public, anon;
revoke execute on function public.copy_event(uuid) from public, anon;;
