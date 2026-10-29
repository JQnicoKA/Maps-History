-- Les fiefs (niveaux 3 et 4) ne se dessinent qu'à partir du zoom pays, et ils
-- doublent le poids d'une date : 1812 passe de 3,2 à 5,2 Mo de GeoJSON. La
-- carte ne les demande donc qu'une fois arrivée à ce zoom.
create or replace function public.territory_ids_at(at_year numeric, max_level integer default 2)
returns table(id uuid)
language sql
stable
set search_path to ''
as $function$
  select t.id
  from public.territories t
  where coalesce(t.start_year, -1000000) <= at_year
    and coalesce(t.end_year, 1000000) > at_year
    and t.admin_level <= max_level;
$function$;;
