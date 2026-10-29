-- Bornes inclusives des deux côtés : Cliopatria enchaîne des versions
-- contiguës et disjointes (1453-1458, puis 1459-1462), donc une année tombe
-- dans une seule d'entre elles.
--
-- `max_level` est accepté sans être utilisé : Cliopatria n'a qu'un seul rang
-- politique, là où OHM en a trois. La carte appelle les deux jeux de la même
-- façon, et c'est une ligne de configuration qui choisit.
create or replace function public.polity_ids_at(at_year numeric, max_level integer default 2)
returns table(id uuid)
language sql
stable
set search_path to ''
as $function$
  select p.id
  from public.polities p
  where p.start_year <= at_year
    and p.end_year >= at_year
    and max_level is not null;
$function$;

-- Mêmes propriétés que territories_by_ids, pour que la couche MapLibre ne sache
-- pas de quel jeu elle vient. `level` et `standalone` sont constants : tout
-- Cliopatria est au rang le plus haut, donc tout se dessine à tous les zooms.
create or replace function public.polities_by_ids(ids uuid[])
returns jsonb
language sql
stable
set search_path to ''
as $function$
  select jsonb_build_object(
    'type', 'FeatureCollection',
    'features', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'type', 'Feature',
          'properties', jsonb_build_object(
            'id', p.id,
            'name', p.name,
            'level', 2,
            'standalone', true,
            'area', p.area,
            'wikidata', p.wikidata,
            'anchor', jsonb_build_array(
              round(public.st_x(p.anchor)::numeric, 5),
              round(public.st_y(p.anchor)::numeric, 5)
            )
          ),
          'geometry', public.ST_AsGeoJSON(p.geom)::jsonb
        )
      ),
      '[]'::jsonb
    )
  )
  from public.polities p
  where p.id = any(ids);
$function$;;
