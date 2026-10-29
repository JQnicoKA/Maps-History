-- MapLibre pose une étiquette par partie d'un MultiPolygone : l'Empire byzantin
-- en compte 58, le califat abbasside 63. D'où un point d'ancrage unique, calculé
-- sur la plus grande partie pour que le nom tombe sur le continent et non sur
-- une île perdue. ST_PointOnSurface plutôt que ST_Centroid : le centroïde d'un
-- territoire en croissant peut tomber hors de ses terres.
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
$$;;
