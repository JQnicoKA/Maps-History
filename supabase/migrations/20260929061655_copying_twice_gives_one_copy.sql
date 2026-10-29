-- Taking the same event twice gave two of it.
--
-- The star was counted once — `copies` has a key that saw to that — but the
-- rows were made again, so a second tap on a button that said "copié" left a
-- duplicate on the reader's own map. `origin_id` already knew the answer;
-- nothing was asking it.
--
-- Idempotent now: the second call hands back the first copy.
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

  -- Already taken: hand back the one they have rather than a second of it.
  select e.id into made
  from public.events e
  where e.user_id = me and e.origin_id = source.id
  limit 1;
  if made is not null then
    return made;
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

revoke execute on function public.copy_event(uuid) from public, anon;;
