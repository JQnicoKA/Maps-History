-- `ohm` rejoint les propriétés du jeu de référence.
--
-- C'est par lui que le téléphone ôte de sa planche les lieux que ce lecteur a
-- masqués. Le tri se fait là-bas et non ici, à dessein : une année de lieux
-- pèse 2,2 Mo et reste en cache tant qu'on ne change pas d'année, alors que
-- le masque, lui, change dès qu'on touche une ville. Filtrer côté serveur
-- rendrait tout le cache caduc à chaque masquage — pour une liste qui tient
-- dans une poignée d'entiers.
create or replace function public.places_at(
  at_year numeric,
  types text[] default array['city', 'town']
) returns jsonb
language sql stable
set search_path to ''
as $$
  select jsonb_build_object(
    'type', 'FeatureCollection',
    'features', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'type', 'Feature',
          'properties', jsonb_build_object(
            'ohm', p.ohm_id, 'name', p.name, 'kind', p.type
          ),
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
$$;

-- Les villes de ce lecteur en vigueur telle année, prêtes pour la planche.
--
-- `kind` vaut toujours `city`. Le jeu de référence distingue la ville du
-- bourg pour s'éclaircir — 6 098 villes dès le zoom 4,5, 17 181 bourgs à
-- partir de 6,5, sans quoi 23 279 points feraient un champ de pastilles. Le
-- lecteur n'a pas ce problème : il en posera quelques-unes, chacune
-- délibérément, et ce qu'on pose sur sa carte on doit le voir en la
-- regardant.
create or replace function public.drawn_places_at(at_year numeric)
returns jsonb
language sql stable
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
            'kind', 'city',
            'drawn', true,
            'from', d.start_year,
            'to', d.end_year
          ),
          'geometry', jsonb_build_object(
            'type', 'Point',
            'coordinates', jsonb_build_array(d.longitude, d.latitude)
          )
        )
      ),
      '[]'::jsonb
    )
  )
  from public.drawn_places d
  where d.user_id = auth.uid()
    and d.start_year <= at_year
    -- Pas de fin : elle est encore là. Même lecture que dans `places_at`.
    and coalesce(d.end_year, 1000000) >= at_year;
$$;

-- Tout ce que ce compte a posé, pour la liste qui les gère.
--
-- `security invoker`, donc toujours bornée par la politique de la table —
-- comme `my_territories`.
create or replace function public.my_places()
returns table (
  id uuid,
  name text,
  longitude double precision,
  latitude double precision,
  start_year integer,
  end_year integer,
  shared boolean,
  origin uuid
)
language sql stable
set search_path to ''
as $$
  select
    d.id, d.name, d.longitude, d.latitude,
    d.start_year, d.end_year, d.shared, d.origin_id
  from public.drawn_places d
  order by d.start_year;
$$;;
