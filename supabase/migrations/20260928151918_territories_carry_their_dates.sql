-- A territory's own span, handed over with it.
--
-- Both functions already filtered on start_year and end_year to decide what
-- stood in the year being read; neither said so in the feature. The card that
-- opens on a tap could name the entity and nothing else about it — not the one
-- fact the map is entirely built on, which is that this thing existed between
-- two dates.
--
-- `from` and `to` rather than the column names: this is the GeoJSON the app
-- reads, and every other span in it is a `from`/`to` pair.

create or replace function public.drawn_polities_at(at_year numeric)
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
            'id', d.id,
            'name', d.name,
            'level', 2,
            'standalone', true,
            'drawn', true,
            'area', d.area,
            'wash', d.wash,
            'from', d.start_year,
            'to', d.end_year,
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
$function$;

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
            'from', p.start_year,
            'to', p.end_year,
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
