-- Les territoires qu'un lecteur dessine lui-même.
--
-- Mêmes colonnes utiles que `polities`, plus un propriétaire : le rendu les
-- fusionne avec la référence partagée au lieu d'avoir deux chemins de dessin.
--
-- `wash` est ici un entier, l'indice dans `palette.washes`, comme pour la
-- référence — mais calculé à l'enregistrement en évitant les voisins, et non
-- par la coloration globale du graphe, à laquelle un polygone dessiné ne peut
-- pas participer.
create table if not exists public.drawn_polities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade
    default auth.uid(),
  name text not null,
  start_year integer not null,
  end_year integer not null,
  wash integer not null default 0,
  -- Calculés à l'écriture, comme pour la référence : l'ancre porte l'étiquette,
  -- l'aire sert à trier et à décider quoi dessiner en premier.
  anchor geometry(Point, 4326),
  area double precision,
  geom geometry(MultiPolygon, 4326) not null,
  created_at timestamptz not null default now(),
  check (end_year >= start_year)
);

create index if not exists drawn_polities_user_idx
  on public.drawn_polities (user_id, start_year, end_year);
create index if not exists drawn_polities_geom_idx
  on public.drawn_polities using gist (geom);

alter table public.drawn_polities enable row level security;

create policy "own drawn polities" on public.drawn_polities
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());;
