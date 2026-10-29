-- La liste dit si un territoire est modifiable ; le tracé se lit à part.
--
-- Le tracé pèse quelques kilo-octets par territoire, et la liste n'en a
-- aucun usage : elle montre un nom, des années et une silhouette. Le
-- renvoyer pour chacun serait payer à chaque ouverture du panneau ce dont on
-- ne se sert qu'en appuyant sur le crayon.
--
-- Pour défaire : docs/defaire-territoires-modifiables.sql
drop function if exists public.my_territories();

create function public.my_territories()
returns table (
  id uuid,
  name text,
  start_year integer,
  end_year integer,
  area double precision,
  shape jsonb,
  shared boolean,
  editable boolean
)
language sql
stable
set search_path to ''
as $function$
  select
    d.id, d.name, d.start_year, d.end_year, d.area,
    public.ST_AsGeoJSON(
      public.ST_SimplifyPreserveTopology(d.geom, 0.1), 2
    )::jsonb,
    d.shared,
    d.strokes is not null
  from public.drawn_polities d
  order by d.start_year;
$function$;

-- Le tracé d'un seul territoire, et seulement du sien.
--
-- `security invoker` par défaut, donc la sécurité par ligne s'applique telle
-- quelle : il n'y a rien à vérifier ici que la base ne vérifie déjà.
create or replace function public.territory_strokes(wanted uuid)
returns jsonb
language sql
stable
set search_path to ''
as $function$
  select d.strokes from public.drawn_polities d where d.id = wanted;
$function$;;
