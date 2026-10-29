create or replace function public.block_author(kind text, source_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
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
    else
      -- Un genre qu'on ne connaît pas ne désigne personne : on ne bloque pas.
      return;
  end case;

  if them is null or them = me then
    return;
  end if;

  insert into public.blocks (user_id, blocked) values (me, them)
  on conflict do nothing;
end;
$function$;

create or replace function public.count_the_star()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  case new.kind
    when 'event' then
      update public.events set stars = stars + 1 where id = new.source_id;
    when 'character' then
      update public.characters set stars = stars + 1 where id = new.source_id;
    when 'tree' then
      update public.trees set stars = stars + 1 where id = new.source_id;
    else
      -- Les villes et les territoires ne se copient plus, et un classeur
      -- n'est plus une ligne qu'on puisse copier. Une branche vide plutôt
      -- qu'aucune : sans `else`, un genre inconnu lève CASE_NOT_FOUND et fait
      -- échouer la copie entière.
      null;
  end case;
  return new;
end;
$function$;;
