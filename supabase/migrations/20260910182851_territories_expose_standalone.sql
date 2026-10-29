-- Les fiefs autonomes voyagent avec les souverains, quel que soit le zoom :
-- sans eux l'Europe de 1453 est une page blanche de la France à la Russie.
-- Seuls les fiefs recouverts par un souverain attendent le zoom pays.
create or replace function public.territory_ids_at(at_year numeric, max_level integer default 2)
returns table(id uuid)
language sql
stable
set search_path to ''
as $function$
  select t.id
  from public.territories t
  where coalesce(t.start_year, -1000000) <= at_year
    and coalesce(t.end_year, 1000000) > at_year
    and (t.admin_level <= max_level or t.standalone);
$function$;

create or replace function public.territories_by_ids(ids uuid[])
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
            'id', t.id,
            'name', t.name,
            'ohm_id', t.ohm_id,
            -- 2 = État souverain, 3 et 4 = fiefs. `standalone` dit qu'aucun
            -- souverain ne recouvrait ce fief à son époque : la carte le traite
            -- alors comme un souverain et le montre à tous les zooms.
            'level', t.admin_level,
            'standalone', t.standalone,
            'area', round(public.st_area(t.geom)::numeric, 3),
            'anchor', (
              select jsonb_build_array(
                round(public.st_x(s.p)::numeric, 5),
                round(public.st_y(s.p)::numeric, 5)
              )
              from (
                select public.st_pointonsurface(d.geom) as p
                from public.st_dump(t.geom) d
                order by public.st_area(d.geom) desc
                limit 1
              ) s
            )
          ),
          'geometry', public.ST_AsGeoJSON(t.geom)::jsonb
        )
      ),
      '[]'::jsonb
    )
  )
  from public.territories t
  where t.id = any(ids);
$function$;;
