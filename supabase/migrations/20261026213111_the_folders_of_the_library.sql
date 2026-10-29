-- Les classeurs de la bibliothèque.
--
-- Un classeur n'est pas une entité : il n'est qu'un nom porté par ce qui s'y
-- range, dans la colonne `folders`. La collection personnelle les relève donc
-- en parcourant ses propres événements, qu'elle a tous en mémoire. La
-- bibliothèque, elle, n'en a aucun en mémoire — elle les demande par pages de
-- vingt-quatre —, donc la liste de ses classeurs doit être relevée là où elle
-- est écrite.
--
-- Les mêmes gardes que `search_events`, mot pour mot : publié, par un profil
-- qui tient une bibliothèque, non retiré, et par personne que ce lecteur a
-- bloqué ou qui l'a bloqué. Un nom de classeur dit de quoi quelqu'un parle ;
-- il ne doit pas rendre visible d'un bloqué ce que la liste cache déjà.
--
-- `uses` et `last_at` sont ce que le tri de la carte demande : les plus
-- utilisés, et les plus récents. Ils se comptent ici parce qu'ils ne se
-- comptent nulle part ailleurs — c'est le prix du classement par étiquette.
create or replace function public.library_folders(kind text)
returns table(name text, uses integer, last_at timestamptz)
language sql
stable security definer
set search_path to ''
as $$
  with filed as (
    select f as name, e.created_at
    from public.events e
    join public.profiles pr on pr.user_id = e.user_id and pr.library
    cross join unnest(e.folders) as f
    where kind = 'event'
      and e.published
      and not exists (
        select 1 from public.withheld w
        where w.kind = 'event' and w.source_id = e.id
      )
      and not exists (
        select 1 from public.blocks b
        where (b.user_id = auth.uid() and b.blocked = e.user_id)
           or (b.user_id = e.user_id and b.blocked = auth.uid())
      )
    union all
    select f as name, c.created_at
    from public.characters c
    join public.profiles pr on pr.user_id = c.user_id and pr.library
    cross join unnest(c.folders) as f
    where kind = 'character'
      and c.published
      and not exists (
        select 1 from public.withheld w
        where w.kind = 'character' and w.source_id = c.id
      )
      and not exists (
        select 1 from public.blocks b
        where (b.user_id = auth.uid() and b.blocked = c.user_id)
           or (b.user_id = c.user_id and b.blocked = auth.uid())
      )
  )
  select filed.name, count(*)::integer as uses, max(filed.created_at) as last_at
  from filed
  where btrim(filed.name) <> ''
  group by filed.name
  order by filed.name;
$$;

revoke all on function public.library_folders(text) from public;
grant execute on function public.library_folders(text) to authenticated, service_role;;
