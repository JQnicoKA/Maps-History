-- Rattacher sa ligne à l'entrée qu'elle a fait naître.
--
-- Le geste de l'auteur, jamais celui du conservateur : `judge` laisse sa
-- ligne indépendante, et c'est lui qui décide de la lier. Ce qu'il y gagne,
-- ce sont les corrections, par bouton. Ce qu'il y perd est dicté par la base
-- et non choisi : `copies_stay_private` interdit à une copie d'être ouverte à
-- la bibliothèque, donc sa case se referme. Elle n'a plus d'objet — la
-- bibliothèque tient déjà son apport.
--
-- `taken_at` prend la date du jugement, et c'est le cœur du mécanisme. À cet
-- instant l'entrée valait exactement son texte : `copy_one_event` l'avait
-- recopié verbatim. Tout ce qui a été corrigé depuis est donc en retard, et
-- lui est proposé aussitôt. Mettre `now()` l'aurait déclaré à jour en lui
-- laissant son texte d'origine — un mensonge par omission.
create or replace function public.attach(about text, which uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
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

  case about
    when 'event' then
      update public.events
         set origin_id = entry, taken_at = judged, shared = false
       where id = which and user_id = me and origin_id is null
         and exists (
           select 1 from public.events e where e.id = entry and e.published
         );
    when 'character' then
      update public.characters
         set origin_id = entry, taken_at = judged, shared = false
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
$$;

-- Balayer une notification. Pour « stale », la date est l'information : une
-- correction postérieure la fera revenir, et c'est voulu.
create or replace function public.dismiss(sort text, about text, which uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.dismissed (user_id, sort, kind, source_id)
  values (auth.uid(), sort, about, which)
  on conflict (user_id, sort, kind, source_id) do update set at = now();
$$;

revoke execute on function public.attach(text, uuid) from public, anon;
revoke execute on function public.dismiss(text, text, uuid) from public, anon;
grant execute on function public.attach(text, uuid) to authenticated;
grant execute on function public.dismiss(text, text, uuid) to authenticated;;
