-- Le personnage rend ses classeurs à côté de ses arbres — voir la migration
-- précédente pour la raison : `folders` est ce qu'on peut ouvrir, `filing` est
-- ce qui n'est qu'un nom. Seule la clé `filing` est ajoutée ; tout le reste
-- est repris mot pour mot.
create or replace function public.shared_character(wanted uuid)
returns jsonb
language sql
stable security definer
set search_path to ''
as $function$
  select jsonb_build_object(
    'id', c.id,
    'title', c.name,
    'type', 'character',
    'description', c.bio,
    'start_year', c.birth_year, 'start_month', c.birth_month,
    'start_day', c.birth_day, 'start_approx', c.birth_approx,
    'end_year', c.death_year, 'end_month', c.death_month,
    'end_day', c.death_day, 'end_approx', c.death_approx,
    'longitude', c.longitude, 'latitude', c.latitude,
    'author', pr.handle,
    'stars', c.stars,
    'mine', (c.user_id = auth.uid() or public.wrote_it('character', c.id)),
    'copied', exists (
      select 1 from public.copies k
      where k.kind = 'character' and k.source_id = c.id
        and k.user_id = auth.uid()
    ),
    'reported', exists (
      select 1 from public.reports r
      where r.kind = 'character' and r.source_id = c.id
        and r.reporter = auth.uid()
    ),
    'photos', coalesce((
      select jsonb_agg(
               jsonb_build_object('path', p.storage_path, 'source', p.source)
               order by p.position)
      from public.character_photos p where p.character_id = c.id
    ), '[]'::jsonb),
    'cast', coalesce((
      select jsonb_agg(e.title order by e.start_year)
      from public.event_characters ec
      join public.events e on e.id = ec.event_id
      where ec.character_id = c.id and e.published
    ), '[]'::jsonb),
    'filing', coalesce((
      select jsonb_agg(n order by n) from unnest(c.folders) as n
    ), '[]'::jsonb),
    'folders', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'name', held.title,
                 'thing', jsonb_build_object(
                   'id', held.id,
                   'title', held.title,
                   'kind', 'tree',
                   'note', held.note,
                   'start_year', held.start_year,
                   'start_month', null, 'start_day', null,
                   'start_approx', false,
                   'end_year', held.end_year,
                   'end_month', null, 'end_day', null, 'end_approx', false,
                   'longitude', null, 'latitude', null,
                   'cover_path', null,
                   'author', held.author,
                   'stars', held.stars,
                   'mine', held.mine,
                   'copied', held.copied,
                   'reported', held.reported,
                   'rank', 0
                 )
               )
               order by held.title
             )
      from (
        -- `distinct` et non `group by` : la même personne peut figurer deux
        -- fois dans un arbre, et on ne veut pas l'arbre deux fois.
        select distinct
          t.id, t.name as title, t.stars,
          keeper.handle as author,
          (t.user_id = auth.uid() or public.wrote_it('tree', t.id)) as mine,
          (
            select case count(*)
              when 0 then 'vide'
              when 1 then '1 personnage'
              else count(*) || ' personnages · '
                   || count(distinct im.generation) || ' génération'
                   || case when count(distinct im.generation) > 1
                        then 's' else '' end
            end
            from public.tree_members im
            join public.characters ic on ic.id = im.character_id
            where im.tree_id = t.id
          ) as note,
          (
            select min(ic.birth_year)
            from public.tree_members im
            join public.characters ic on ic.id = im.character_id
            where im.tree_id = t.id
          ) as start_year,
          (
            select max(coalesce(ic.death_year, ic.birth_year))
            from public.tree_members im
            join public.characters ic on ic.id = im.character_id
            where im.tree_id = t.id
          ) as end_year,
          exists (
            select 1 from public.copies ico
            where ico.kind = 'tree' and ico.source_id = t.id
              and ico.user_id = auth.uid()
          ) as copied,
          exists (
            select 1 from public.reports ire
            where ire.kind = 'tree' and ire.source_id = t.id
              and ire.reporter = auth.uid()
          ) as reported
        from public.tree_members m
        join public.trees t on t.id = m.tree_id
        join public.profiles keeper on keeper.user_id = t.user_id
        where m.character_id = c.id
          and t.published
          -- Les mêmes deux conditions que toutes les autres portes : un arbre
          -- retiré sur signalement ne s'offre pas, et rien ne traverse un
          -- blocage.
          and not exists (
            select 1 from public.withheld w
            where w.kind = 'tree' and w.source_id = t.id
          )
          and not exists (
            select 1 from public.blocks b
            where (b.user_id = auth.uid() and b.blocked = t.user_id)
               or (b.user_id = t.user_id and b.blocked = auth.uid())
          )
      ) held
    ), '[]'::jsonb)
  )
  from public.characters c
  join public.profiles pr on pr.user_id = c.user_id and pr.library
  where c.id = wanted
    and c.published
    and not exists (
      select 1 from public.withheld w
      where w.kind = 'character' and w.source_id = c.id
    )
    and not exists (
      select 1 from public.blocks b
      where (b.user_id = auth.uid() and b.blocked = c.user_id)
         or (b.user_id = c.user_id and b.blocked = auth.uid())
    );
$function$;;
