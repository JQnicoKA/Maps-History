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

  -- `folders` et `importance` suivent, et c'est nouveau : un classeur était
  -- une ligne à part, qui ne partait pas avec l'événement — on recevait un
  -- fait sans savoir de quoi il parlait. Maintenant que le classement n'est
  -- qu'un nom écrit sur l'événement, il voyage sans rien coûter, et trois
  -- événements carolingiens arrivent groupés chez qui les prend.
  insert into public.events (
    user_id, title, description, type,
    start_year, start_month, start_day, start_approx,
    end_year, end_month, end_day, end_approx,
    longitude, latitude, folders, importance, shared, origin_id, taken_at
  ) values (
    me, source.title, source.description, source.type,
    source.start_year, source.start_month, source.start_day, source.start_approx,
    source.end_year, source.end_month, source.end_day, source.end_approx,
    source.longitude, source.latitude, source.folders, source.importance,
    false, source.id, now()
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
$function$;;
