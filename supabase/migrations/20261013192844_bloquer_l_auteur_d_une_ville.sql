-- Le `case` n'a pas de branche `else` : un genre inconnu y lève
-- CASE_NOT_FOUND, et bloquer l'auteur d'une ville échouait.
create or replace function public.block_author(kind text, source_id uuid)
returns void
language plpgsql security definer
set search_path to ''
as $$
declare
  me uuid := auth.uid();
  them uuid;
begin
  if me is null then
    raise exception 'Il faut être connecté.';
  end if;

  case kind
    when 'event' then
      select e.user_id into them from public.events e where e.id = source_id;
    when 'folder' then
      select f.user_id into them from public.folders f where f.id = source_id;
    when 'character' then
      select c.user_id into them from public.characters c where c.id = source_id;
    when 'tree' then
      select t.user_id into them from public.trees t where t.id = source_id;
    when 'territory' then
      select d.user_id into them
      from public.drawn_polities d where d.id = source_id;
    when 'place' then
      select d.user_id into them
      from public.drawn_places d where d.id = source_id;
  end case;

  if them is null or them = me then
    return;
  end if;

  insert into public.blocks (user_id, blocked) values (me, them)
  on conflict do nothing;
end;
$$;;
