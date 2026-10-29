-- Plus aucun calcul géométrique dans le chemin chaud : l'aire et l'ancre sont
-- lues, la géométrie est sérialisée, c'est tout.
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
            'area', t.area,
            'anchor', jsonb_build_array(
              round(public.st_x(t.anchor)::numeric, 5),
              round(public.st_y(t.anchor)::numeric, 5)
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
