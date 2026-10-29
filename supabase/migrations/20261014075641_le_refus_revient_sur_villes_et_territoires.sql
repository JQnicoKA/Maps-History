-- `shared` revient sur les deux tables, et pour une bonne raison.
--
-- Il y avait deux sens dans cette colonne, et je n'en avais vu qu'un en la
-- supprimant :
--
-- 1. « elle est dans le catalogue, où l'on vient la copier » — mort, puisque
--    ces deux genres ne vont plus au catalogue ;
-- 2. « son auteur autorise la bibliothèque à s'en servir » — bien vivant, et
--    **plus important ici qu'ailleurs** : ce qu'un conservateur fait d'une
--    ville, c'est la mettre sur la carte de tout le monde, ce qui va plus
--    loin que d'en tirer une entrée.
--
-- La règle est la même que partout : ouvert par défaut, à l'auteur de
-- décocher.
alter table public.drawn_places
  add column shared boolean not null default true;
alter table public.drawn_polities
  add column shared boolean not null default true;

comment on column public.drawn_places.shared is
  'L''auteur autorise la bibliothèque à la promouvoir dans le fond de carte.';
comment on column public.drawn_polities.shared is
  'L''auteur autorise la bibliothèque à le promouvoir dans le fond de carte.';

drop function if exists public.my_places();
create function public.my_places()
returns table (
  id uuid, name text,
  longitude double precision, latitude double precision,
  start_year integer, end_year integer, shared boolean
)
language sql stable
set search_path to ''
as $$
  select d.id, d.name, d.longitude, d.latitude,
         d.start_year, d.end_year, d.shared
  from public.drawn_places d
  order by d.start_year;
$$;

drop function if exists public.my_territories();
create function public.my_territories()
returns table (
  id uuid, name text,
  start_year integer, end_year integer,
  area double precision, shape jsonb, shared boolean
)
language sql stable
set search_path to ''
as $$
  select
    d.id, d.name, d.start_year, d.end_year, d.area,
    public.ST_AsGeoJSON(
      public.ST_SimplifyPreserveTopology(d.geom, 0.1), 2
    )::jsonb,
    d.shared
  from public.drawn_polities d
  order by d.start_year;
$$;

revoke execute on function public.my_places() from public, anon;
revoke execute on function public.my_territories() from public, anon;;
