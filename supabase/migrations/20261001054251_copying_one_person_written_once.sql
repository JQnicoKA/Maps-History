/**
 * Copies one person into an account, or finds the one already there.
 *
 * Three things need this now — an event bringing its cast, a tree bringing
 * its whole household, and a reader taking a single person — and three
 * copies of it would drift. The dedup is the part that must not: a reader
 * who takes two events about Clovis, and then the tree he stands in, must
 * end with one Clovis.
 *
 * Returns the person this reader now has. Counts the star, since "how many
 * readers have this" is true whatever route brought them.
 */
create or replace function public.copy_one_character(source_id uuid, me uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  source public.characters%rowtype;
  made uuid;
begin
  select * into source from public.characters c where c.id = source_id;
  if not found then
    return null;
  end if;

  select c.id into made
  from public.characters c
  where c.user_id = me
    and (c.origin_id = source.id or c.id = source.id)
  limit 1;
  if made is not null then
    return made;
  end if;

  insert into public.characters (
    user_id, name, bio,
    birth_year, birth_month, birth_day, birth_approx,
    death_year, death_month, death_day, death_approx,
    longitude, latitude, shared, origin_id
  ) values (
    me, source.name, source.bio,
    source.birth_year, source.birth_month, source.birth_day, source.birth_approx,
    source.death_year, source.death_month, source.death_day, source.death_approx,
    source.longitude, source.latitude, false, source.id
  ) returning id into made;

  insert into public.character_photos (character_id, storage_path, position, source)
  select made, p.storage_path, p.position, p.source
  from public.character_photos p where p.character_id = source.id;

  insert into public.copies (kind, source_id, user_id)
  values ('character', source.id, me) on conflict do nothing;

  return made;
end;
$function$;

-- And the two that used to carry their own version of it.
create or replace function public.copy_one_event(source_id uuid, me uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  source public.events%rowtype;
  made uuid;
  cast_member uuid;
begin
  select * into source from public.events e where e.id = source_id;
  if not found then
    return null;
  end if;

  select e.id into made
  from public.events e
  where e.user_id = me
    and (e.origin_id = source.id or e.id = source.id)
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
  from public.event_photos p where p.event_id = source.id;

  for cast_member in
    select ec.character_id from public.event_characters ec
    where ec.event_id = source.id
  loop
    insert into public.event_characters (event_id, character_id)
    values (made, public.copy_one_character(cast_member, me))
    on conflict do nothing;
  end loop;

  insert into public.copies (kind, source_id, user_id)
  values ('event', source.id, me) on conflict do nothing;

  return made;
end;
$function$;

create or replace function public.copy_character(wanted uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  me uuid := auth.uid();
  owner uuid;
begin
  if me is null then
    raise exception 'Il faut être connecté.';
  end if;

  select c.user_id into owner
  from public.characters c
  where c.id = wanted
    and c.shared
    and not exists (
      select 1 from public.withheld w
      where w.kind = 'character' and w.source_id = c.id
    )
    and not exists (
      select 1 from public.blocks b
      where (b.user_id = me and b.blocked = c.user_id)
         or (b.user_id = c.user_id and b.blocked = me)
    );
  if owner is null then
    raise exception 'Ce personnage n''est plus partagé.';
  end if;
  if owner = me then
    raise exception 'Ce personnage est déjà le vôtre.';
  end if;

  return public.copy_one_character(wanted, me);
end;
$function$;

revoke execute on function public.copy_one_character(uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.copy_one_event(uuid, uuid)
  from public, anon, authenticated;
revoke execute on function public.copy_character(uuid) from public, anon;;
