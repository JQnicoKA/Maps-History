-- Agglomérations historiques d'OpenHistoricalMap. Contrairement aux territoires,
-- pas de table de transit ni de recollage : un point n'est jamais découpé par le
-- bord d'un carreau, la déduplication par ohm_id se fait à l'extraction.
create table public.places (
  id uuid primary key default gen_random_uuid(),
  ohm_id bigint not null unique,
  name text not null,
  -- city | town | village, tel que fourni par OHM
  type text not null,
  start_year numeric,
  end_year numeric,
  longitude double precision not null check (longitude between -180 and 180),
  latitude double precision not null check (latitude between -90 and 90),
  created_at timestamptz not null default now()
);

create index places_span_idx on public.places (start_year, end_year);
create index places_type_idx on public.places (type);

alter table public.places enable row level security;

-- TEMPORAIRE, comme partout ailleurs : pas encore de comptes.
create policy "prototype open access" on public.places
  for all to anon, authenticated using (true) with check (true);

/**
 * Les agglomérations existant à une année décimale donnée, en GeoJSON.
 * `types` restreint aux classes voulues — on ne descend aux villages qu'une fois
 * zoomé, sinon la planche devient illisible et le transfert inutilement lourd.
 */
create function public.places_at(at_year numeric, types text[] default array['city','town'])
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
          'properties', jsonb_build_object('name', p.name, 'kind', p.type),
          'geometry', jsonb_build_object(
            'type', 'Point',
            'coordinates', jsonb_build_array(p.longitude, p.latitude)
          )
        )
      ),
      '[]'::jsonb
    )
  )
  from public.places p
  where p.type = any(types)
    and coalesce(p.start_year, -1000000) <= at_year
    and coalesce(p.end_year, 1000000) > at_year;
$$;;
