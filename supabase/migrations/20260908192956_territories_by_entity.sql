-- Replaced by the two functions below: fetching the whole snapshot re-sent the
-- same polygons on every date change, even when nothing had moved.
drop function if exists public.territories_at(numeric);

/**
 * Which entities were in force in a given decimal year — identifiers only.
 * A few hundred bytes, so the client can work out what it is actually missing
 * before asking for any geometry.
 */
create function public.territory_ids_at(at_year numeric)
returns table (id uuid)
language sql
stable
set search_path = ''
as $$
  select t.id
  from public.territories t
  where coalesce(t.start_year, -1000000) <= at_year
    and coalesce(t.end_year, 1000000) > at_year;
$$;

/**
 * Geometry for the entities the client does not already hold, as a GeoJSON
 * FeatureCollection. Borders do not change once extracted, so a polygon needs
 * to cross the wire once per session, not once per date.
 */
create function public.territories_by_ids(ids uuid[])
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
            'ohm_id', t.ohm_id
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
