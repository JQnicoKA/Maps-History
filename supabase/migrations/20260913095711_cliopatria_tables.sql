-- Cliopatria (Seshat Global History Databank, CC BY 4.0) : 12 043 versions de
-- 1 540 polités, de 3400 av. J.-C. à 2024. Contrairement à OHM, la géométrie
-- arrive entière — pas de tuiles, donc pas de recollage : il n'y a qu'à
-- charger, simplifier et servir.
create table if not exists public.polity_fragments (
  id bigint generated always as identity primary key,
  name text not null,
  start_year integer not null,
  end_year integer not null,
  area_km2 double precision,
  wikidata text,
  wikipedia text,
  seshat_id text,
  geojson jsonb not null
);

create table if not exists public.polities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- Bornes **inclusives** des deux côtés, en années entières : une polité
  -- vivante en l'an y vérifie start_year <= y <= end_year. Les versions
  -- successives sont contiguës et ne se chevauchent jamais (vérifié sur les
  -- 10 089 enchaînements du jeu).
  start_year integer not null,
  end_year integer not null,
  -- Aire en degrés carrés, comme public.territories : c'est l'échelle sur
  -- laquelle la couche d'étiquettes dimensionne le texte. Celle de Cliopatria,
  -- en km², est conservée à part.
  area double precision,
  area_km2 double precision,
  wikidata text,
  wikipedia text,
  seshat_id text,
  anchor geometry(Point, 4326),
  geom geometry(MultiPolygon, 4326) not null
);

create index if not exists polities_period_idx on public.polities (start_year, end_year);
create index if not exists polities_geom_idx on public.polities using gist (geom);

alter table public.polity_fragments enable row level security;
alter table public.polities enable row level security;

create policy "prototype open access" on public.polity_fragments
  for all to anon, authenticated using (true) with check (true);
create policy "prototype open access" on public.polities
  for all to anon, authenticated using (true) with check (true);;
