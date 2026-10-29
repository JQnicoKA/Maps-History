-- Deux notions vivaient dans la même clé, et l'arrivée des classeurs sur les
-- personnages les a mises en collision.
--
--   `folders` disait « ce dans quoi ceci est rangé **et où l'on peut aller** » :
--   les arbres d'un personnage, avec leur porte. Pour un événement il portait
--   ses classeurs, qui n'ont pas de porte puisqu'ils n'ont pas de fiche.
--
-- Un personnage a désormais les deux à la fois. On les sépare donc par ce
-- qu'ils sont et non par le genre qui les porte :
--
--   `folders` — des contenants qu'on peut ouvrir. Les arbres, et rien d'autre.
--   `filing`  — des classeurs : des noms, et rien de plus. Les deux genres.
--
-- Un événement rend donc `folders` vide et ses classeurs dans `filing`, ce qui
-- lui coûte une ligne et rend la forme identique des deux côtés.
create or replace function public.shared_event(wanted uuid)
returns jsonb
language sql
stable security definer
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
    'mine', (e.user_id = auth.uid() or public.wrote_it('event', e.id)),
    'copied', exists (
      select 1 from public.copies c
      where c.kind = 'event' and c.source_id = e.id and c.user_id = auth.uid()
    ),
    'reported', exists (
      select 1 from public.reports r
      where r.kind = 'event' and r.source_id = e.id and r.reporter = auth.uid()
    ),
    'photos', coalesce((
      select jsonb_agg(
               jsonb_build_object('path', p.storage_path, 'source', p.source)
               order by p.position)
      from public.event_photos p where p.event_id = e.id
    ), '[]'::jsonb),
    'cast', coalesce((
      select jsonb_agg(ch.name order by ch.name)
      from public.event_characters ec
      join public.characters ch on ch.id = ec.character_id
      where ec.event_id = e.id
    ), '[]'::jsonb),
    -- Rien à ouvrir : un événement n'est contenu dans rien.
    'folders', '[]'::jsonb,
    'filing', coalesce((
      select jsonb_agg(n order by n) from unnest(e.folders) as n
    ), '[]'::jsonb)
  )
  from public.events e
  join public.profiles pr on pr.user_id = e.user_id and pr.library
  where e.id = wanted
    and e.published
    and not exists (
      select 1 from public.withheld w
      where w.kind = 'event' and w.source_id = e.id
    )
    and not exists (
      select 1 from public.blocks b
      where (b.user_id = auth.uid() and b.blocked = e.user_id)
         or (b.user_id = e.user_id and b.blocked = auth.uid())
    );
$function$;;
