-- Searching by name, and searching by place.
create extension if not exists pg_trgm with schema extensions;
create extension if not exists unaccent with schema extensions;

/**
 * A title reduced to what a reader actually typed.
 *
 * Lower case and stripped of accents, because nobody searching for the
 * Révolution types the accent, and "Marignan" and "marignan" are the same
 * word. Marked immutable so an index can be built on it — `unaccent` is not,
 * on its own, since a dictionary could be reloaded under it; naming the
 * dictionary explicitly is what makes the result depend on the input alone.
 */
create or replace function public.plain(subject text)
returns text
language sql
immutable
strict
parallel safe
set search_path to ''
as $function$
  select extensions.unaccent('extensions.unaccent'::regdictionary, lower(subject));
$function$;

/**
 * Where an event stands, as geography rather than two numbers.
 *
 * Stored and generated: the pair is already there and cannot disagree with
 * it, and a geographic index needs a column to sit on. Without it, "what has
 * the community made about this part of the world" reads every row.
 */
alter table public.events
  add column spot public.geography(Point, 4326)
  generated always as (
    public.ST_SetSRID(public.ST_MakePoint(longitude, latitude), 4326)::public.geography
  ) stored;

create index events_shared_spot_idx on public.events using gist (spot)
  where shared;

create index events_shared_title_idx on public.events
  using gin (public.plain(title) extensions.gin_trgm_ops)
  where shared;

-- Time is asked as an overlap — "what stood between these two years" — so the
-- start is what the range is tested against first.
create index events_shared_span_idx on public.events (start_year)
  where shared;;
