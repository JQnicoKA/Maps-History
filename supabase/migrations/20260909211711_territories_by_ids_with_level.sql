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
            -- 2 = État souverain, 3 et 4 = fiefs. La carte s'en sert pour ne
            -- montrer les seconds qu'à partir du zoom pays.
            'level', t.admin_level,
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
