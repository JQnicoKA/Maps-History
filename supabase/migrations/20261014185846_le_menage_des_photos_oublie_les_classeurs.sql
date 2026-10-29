create or replace function public.erasable_by_me(paths text[])
 returns setof text
 language sql
 stable security definer
 set search_path to ''
as $function$
  select p
  from unnest(paths) as p
  where
    -- Le dossier de l'appelant, et lui seul. Le reste, il ne pourrait pas
    -- l'effacer de toute façon — la policy de stockage l'interdit — et
    -- répondre à son sujet serait lui apprendre quelque chose sur la
    -- collection d'autrui.
    (storage.foldername(p))[1] = auth.uid()::text

    -- Et seulement si rien qui appartienne à un autre compte ne le réclame.
    -- « Un autre compte » et non « une autre ligne » : à la suppression d'un
    -- compte, toutes les lignes de l'appelant s'en vont en cascade, donc
    -- elles ne comptent pas comme des références survivantes.
    --
    -- Plus de couverture de classeur à interroger : un classeur n'est qu'un
    -- nom, il ne porte pas d'image.
    and not exists (
      select 1
      from public.event_photos ep
      join public.events e on e.id = ep.event_id
      where ep.storage_path = p and e.user_id <> auth.uid()
    )
    and not exists (
      select 1
      from public.character_photos cp
      join public.characters c on c.id = cp.character_id
      where cp.storage_path = p and c.user_id <> auth.uid()
    );
$function$;;
