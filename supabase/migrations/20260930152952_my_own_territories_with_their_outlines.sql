/**
 * What this account has painted, outlines included.
 *
 * The list in the Territoires sheet drew an initial where a territory's only
 * likeness is its own shape — and it had no choice, since the geometry never
 * left the database: PostgREST cannot call `ST_AsGeoJSON` in a select, so a
 * plain read of the table hands back a blob nothing can draw.
 *
 * **`security invoker`, and that matters.** This is not a door into other
 * readers' work like `search_territories`; it reads the caller's own rows and
 * leans on row-level security to say which those are. Written as a definer it
 * would have had to re-check the owner by hand, which is exactly the sort of
 * check one forgets.
 *
 * Coarse on purpose — a tenth of a degree, two decimals — because this feeds
 * a thumbnail and nothing else. The card's own preview asks for finer.
 */
create or replace function public.my_territories()
returns table (
  id uuid,
  name text,
  start_year integer,
  end_year integer,
  area double precision,
  shared boolean,
  shape jsonb
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
    )::jsonb
  from public.drawn_polities d
  order by d.start_year;
$function$;

revoke execute on function public.my_territories() from public, anon;;
