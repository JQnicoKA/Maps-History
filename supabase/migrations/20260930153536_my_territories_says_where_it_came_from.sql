-- The origin comes with the row, so a deletion can say the truth.
--
-- Erasing a territory one painted is final; erasing a copy of somebody
-- else's costs nothing, because theirs still stands in the chronicle. The
-- warning could not tell the two apart without this.
drop function if exists public.my_territories();

create or replace function public.my_territories()
returns table (
  id uuid,
  name text,
  start_year integer,
  end_year integer,
  area double precision,
  shared boolean,
  shape jsonb,
  origin uuid
)
language sql
stable
security invoker
set search_path to ''
as $function$
  select
    d.id, d.name, d.start_year, d.end_year, d.area, d.shared,
    public.ST_AsGeoJSON(
      public.ST_SimplifyPreserveTopology(d.geom, 0.1), 2
    )::jsonb,
    d.origin_id
  from public.drawn_polities d
  order by d.start_year;
$function$;

revoke execute on function public.my_territories() from public, anon;;
