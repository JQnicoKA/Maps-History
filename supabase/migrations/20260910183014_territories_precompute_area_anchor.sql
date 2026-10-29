-- L'aire et l'ancre étaient recalculées à chaque appel : ST_Dump puis
-- ST_PointOnSurface sur chaque partie, pour 560 entités à la fois en 1812.
-- Assez cher pour dépasser le statement_timeout du rôle anon. Ce sont des
-- valeurs fixes une fois la géométrie posée : elles deviennent des colonnes.
alter table public.territories
  add column if not exists area double precision,
  add column if not exists anchor geometry(Point, 4326);;
