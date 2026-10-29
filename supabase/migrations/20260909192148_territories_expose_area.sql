-- L'aire sert à dimensionner le nom sur la carte : un empire mérite de plus
-- grandes lettres qu'une principauté, comme sur une planche d'atlas.
create or replace function public.territories_by_ids(ids uuid[])
returns jsonb
language sql
stable
set search_path = ''
as $$
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
            'area', round(public.st_area(t.geom)::numeric, 3)
          ),
          'geometry', public.ST_AsGeoJSON(t.geom)::jsonb
        )
      ),
      '[]'::jsonb
    )
  )
  from public.territories t
  where t.id = any(ids);
$$;;
