-- `wash` est un indice dans palette.washes, issu de la coloration de carte :
-- deux polités qui se sont un jour touchées n'ont jamais le même. Voir
-- scripts/colour-polities.mjs.
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
            'wash', w.wash,
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
  left join public.polity_wash w on w.name = p.name
  where p.id = any(ids);
$function$;;
