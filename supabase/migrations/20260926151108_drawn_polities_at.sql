-- Les territoires dessinés par ce compte, en vigueur à cette date.
--
-- Rendus en une fois, géométrie comprise, contrairement à la référence : ils
-- se comptent en dizaines et non en centaines, et leurs polygones tracés au
-- doigt sont bien plus légers que ceux de Cliopatria.
--
-- Même forme de sortie que `polities_by_ids`, pour que l'application les
-- verse dans la même collection sans les distinguer — `drawn` mis à part, qui
-- dit à l'interface lesquels peuvent être modifiés.
create or replace function public.drawn_polities_at(at_year numeric)
returns jsonb
language sql
stable
security invoker
set search_path to ''
as $$
  select jsonb_build_object(
    'type', 'FeatureCollection',
    'features', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'type', 'Feature',
          'properties', jsonb_build_object(
            'id', d.id,
            'name', d.name,
            'level', 2,
            'standalone', true,
            'drawn', true,
            'area', d.area,
            'wash', d.wash,
            'anchor', jsonb_build_array(
              round(public.ST_X(d.anchor)::numeric, 5),
              round(public.ST_Y(d.anchor)::numeric, 5)
            )
          ),
          'geometry', public.ST_AsGeoJSON(d.geom)::jsonb
        )
      ),
      '[]'::jsonb
    )
  )
  from public.drawn_polities d
  where d.user_id = auth.uid()
    and d.start_year <= at_year
    and d.end_year >= at_year;
$$;

revoke all on function public.drawn_polities_at(numeric) from public, anon;
grant execute on function public.drawn_polities_at(numeric) to authenticated;;
