create or replace function public.attach(about text, which uuid)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  me uuid := auth.uid();
  entry uuid;
  judged timestamptz;
begin
  if me is null then
    raise exception 'Il faut être connecté.';
  end if;

  select r.became, r.at into entry, judged
    from public.review r
   where r.kind = about and r.source_id = which
     and r.state = 'admitted' and r.who = me;
  if entry is null then
    raise exception 'Rien à rattacher ici.';
  end if;

  -- La case ne se referme plus. Elle le faisait — « une copie ne se propose
  -- pas » — parce qu'une copie était condamnée au silence ; elle ne l'est
  -- plus, et ce que l'auteur écrira désormais sur sa ligne rattachée peut
  -- encore servir à corriger l'entrée qu'il a fait naître.
  case about
    when 'event' then
      update public.events
         set origin_id = entry, taken_at = judged
       where id = which and user_id = me and origin_id is null
         and exists (
           select 1 from public.events e where e.id = entry and e.published
         );
    when 'character' then
      update public.characters
         set origin_id = entry, taken_at = judged
       where id = which and user_id = me and origin_id is null
         and exists (
           select 1 from public.characters c where c.id = entry and c.published
         );
    else
      raise exception 'Ce genre ne se rattache pas.';
  end case;
  if not found then
    raise exception 'Cette ligne n''est plus la vôtre, ou elle est déjà rattachée.';
  end if;

  insert into public.copies (kind, source_id, user_id)
  values (about, entry, me) on conflict do nothing;
end;
$function$;;
