-- La fiche d'un personnage partagé nommait les arbres où il se tient, mais
-- avec `thing: null` — un nom et rien derrière. La fiche exige les deux
-- moitiés avant de dessiner une porte : un `filedDoor` dans le look et un
-- `thing` ici. Voici la seconde.
--
-- Rapiécé plutôt que réécrit : la fonction fait cent lignes et n'a qu'un bloc
-- à changer. Le `raise` garantit qu'on ne remplace rien par mégarde.
do $patch$
declare
  src text;
  ancien text := $ancien$    'folders', coalesce((
      select jsonb_agg(
               jsonb_build_object('name', held.name, 'thing', null)
               order by held.name)
      from (
        select distinct t.name
        from public.tree_members m
        join public.trees t on t.id = m.tree_id
        where m.character_id = c.id and t.shared
      ) held
    ), '[]'::jsonb)$ancien$;
  neuf text := $neuf$    'folders', coalesce((
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
          t.user_id = auth.uid() as mine,
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
          and t.shared
          -- Les mêmes deux conditions que toutes les autres portes : un arbre
          -- retiré sur signalement ne s'offre pas, et rien ne traverse un
          -- blocage. L'ancien bloc ne les vérifiait pas.
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
    ), '[]'::jsonb)$neuf$;
begin
  select pg_get_functiondef(p.oid) into src
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'shared_character';

  if src is null then
    raise exception 'shared_character introuvable';
  end if;
  if position(ancien in src) = 0 then
    raise exception 'le bloc folders de shared_character ne correspond plus';
  end if;

  execute replace(src, ancien, neuf);
end $patch$;;
