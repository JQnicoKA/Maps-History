-- Where somebody stood, as geography rather than two numbers.
--
-- Null for the people written down before the map knew about them; a null
-- geography simply never satisfies ST_DWithin, which is the right answer —
-- somebody with no place cannot be near anything.
alter table public.characters
  add column spot public.geography(Point, 4326)
  generated always as (
    public.ST_SetSRID(public.ST_MakePoint(longitude, latitude), 4326)::public.geography
  ) stored;

create index characters_shared_spot_idx on public.characters using gist (spot)
  where shared;

create index characters_shared_name_idx on public.characters
  using gin (public.plain(name) extensions.gin_trgm_ops)
  where shared;

create index characters_shared_life_idx on public.characters (birth_year)
  where shared;

create index characters_shared_stars_idx on public.characters (stars desc, id desc)
  where shared;

create index characters_shared_recent_idx on public.characters (created_at desc, id desc)
  where shared;;
