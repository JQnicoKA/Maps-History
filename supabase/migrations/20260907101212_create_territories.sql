create extension if not exists postgis;

-- Staging: vector tiles clip geometry at their edges, so one country arrives as
-- several fragments sharing an ohm_id. Loaded as raw GeoJSON, stitched below.
create table public.territory_fragments (
  id bigserial primary key,
  ohm_id bigint,
  name text,
  start_year numeric,
  end_year numeric,
  geojson jsonb not null
);

-- One row per polity per period, geometry already stitched and simplified.
create table public.territories (
  id uuid primary key default gen_random_uuid(),
  ohm_id bigint,
  name text not null,
  start_year numeric,
  end_year numeric,
  geom geometry(MultiPolygon, 4326) not null,
  created_at timestamptz not null default now()
);

create index territories_span_idx on public.territories (start_year, end_year);
create index territories_geom_idx on public.territories using gist (geom);

alter table public.territory_fragments enable row level security;
alter table public.territories enable row level security;

-- TEMPORARY, as everywhere else: no accounts yet.
create policy "prototype open access" on public.territory_fragments
  for all to anon, authenticated using (true) with check (true);
create policy "prototype open access" on public.territories
  for all to anon, authenticated using (true) with check (true);

/**
 * The world as it stood in a given decimal year, as a GeoJSON FeatureCollection.
 * Geometry never crosses the wire as PostGIS binary — the app reads plain
 * GeoJSON and hands it straight to MapLibre.
 */
create function public.territories_at(at_year numeric)
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
          'properties', jsonb_build_object('name', t.name, 'ohm_id', t.ohm_id),
          'geometry', public.ST_AsGeoJSON(t.geom)::jsonb
        )
      ),
      '[]'::jsonb
    )
  )
  from public.territories t
  where coalesce(t.start_year, -1000000) <= at_year
    and coalesce(t.end_year, 1000000) > at_year;
$$;;
