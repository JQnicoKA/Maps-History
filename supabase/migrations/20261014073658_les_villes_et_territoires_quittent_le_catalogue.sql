-- Huit portes qui n'ont plus de porte à ouvrir.
--
-- Les villes et les territoires ne se cherchent plus, ne se copient plus et
-- ne s'étoilent plus : ils vont dans le fond de carte, où tout le monde les a
-- sans rien demander. Quatre de ces fonctions ont été écrites hier et sont
-- supprimées aujourd'hui — c'est le bon échange, une demi-journée contre une
-- moitié de modèle.
drop function if exists public.search_places(
  text, numeric, numeric, double precision, double precision, double precision,
  text, integer, double precision, uuid
);
drop function if exists public.shared_place(uuid);
drop function if exists public.copy_place(uuid);
drop function if exists public.places_like(text, integer, boolean);

drop function if exists public.search_territories(
  text, numeric, numeric, double precision, double precision, double precision,
  text, integer, double precision, uuid
);
drop function if exists public.shared_territory(uuid);
drop function if exists public.copy_territory(uuid);
drop function if exists public.territories_like(text, integer, boolean);

-- Le compteur d'étoiles perd ses deux dernières branches : plus personne ne
-- copie une ville ni un territoire, et les colonnes `stars` qu'il incrémentait
-- disparaissent juste en dessous.
create or replace function public.count_the_star()
returns trigger
language plpgsql security definer
set search_path to ''
as $$
begin
  case new.kind
    when 'event' then
      update public.events set stars = stars + 1 where id = new.source_id;
    when 'folder' then
      update public.folders set stars = stars + 1 where id = new.source_id;
    when 'character' then
      update public.characters set stars = stars + 1 where id = new.source_id;
    when 'tree' then
      update public.trees set stars = stars + 1 where id = new.source_id;
    else
      -- Les villes et les territoires ne se copient plus. Une branche vide
      -- plutôt qu'aucune : sans `else`, un genre inconnu lève CASE_NOT_FOUND
      -- et fait échouer la copie entière.
      null;
  end case;
  return new;
end;
$$;

-- Ce qu'un lecteur dessine n'est plus qu'à lui : rien à partager, rien à
-- étoiler, rien à copier de personne. La forme du retour change, donc il faut
-- les déposer avant de les reposer.
drop function if exists public.my_places();
create function public.my_places()
returns table (
  id uuid,
  name text,
  longitude double precision,
  latitude double precision,
  start_year integer,
  end_year integer
)
language sql stable
set search_path to ''
as $$
  select d.id, d.name, d.longitude, d.latitude, d.start_year, d.end_year
  from public.drawn_places d
  order by d.start_year;
$$;

drop function if exists public.my_territories();
create function public.my_territories()
returns table (
  id uuid,
  name text,
  start_year integer,
  end_year integer,
  area double precision,
  shape jsonb
)
language sql stable
set search_path to ''
as $$
  select
    d.id, d.name, d.start_year, d.end_year, d.area,
    public.ST_AsGeoJSON(
      public.ST_SimplifyPreserveTopology(d.geom, 0.1), 2
    )::jsonb
  from public.drawn_polities d
  order by d.start_year;
$$;

revoke execute on function public.my_places() from public, anon;
revoke execute on function public.my_territories() from public, anon;

alter table public.drawn_places drop column shared;
alter table public.drawn_places drop column stars;
alter table public.drawn_places drop column origin_id;

alter table public.drawn_polities drop column shared;
alter table public.drawn_polities drop column stars;
alter table public.drawn_polities drop column origin_id;

drop index if exists public.drawn_places_shared;;
