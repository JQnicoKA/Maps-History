/**
 * The catalogue of events, as one page of it.
 *
 * **A door, not an opening.** Row-level security on `events` is untouched:
 * every ordinary query in the application still sees only its own reader's
 * rows. What the community may see comes through here and its companions,
 * which are short enough to audit line by line — shared only, no account
 * taken as an argument, nothing about the author but their pseudonym.
 * Withheld rows are gone for everyone; blocking works both ways.
 *
 * The period is asked on the **continuous axis** rather than in whole years,
 * because the reader states it as precisely as they know it: a week either
 * side of a day, or a century either side of a year. `from_key` and `to_key`
 * carry the same measure the application computes in `toSortKey`.
 *
 * Two orderings, and only two. Ordering by nearness was offered for a while
 * and taken out: it answers the same wish as the region filter, and worse —
 * "what is there around here" is a question about what to show, not about
 * what to show first.
 */
create or replace function public.search_events(
  words text default null,
  from_key numeric default null,
  to_key numeric default null,
  near_lon double precision default null,
  near_lat double precision default null,
  within_m double precision default null,
  sort text default 'stars',
  page_size integer default 30,
  after_rank double precision default null,
  after_id uuid default null
)
returns table (
  id uuid,
  title text,
  kind text,
  start_year integer,
  start_month smallint,
  start_day smallint,
  start_approx boolean,
  end_year integer,
  end_month smallint,
  end_day smallint,
  end_approx boolean,
  longitude double precision,
  latitude double precision,
  cover_path text,
  author text,
  stars integer,
  mine boolean,
  copied boolean,
  reported boolean,
  rank double precision
)
language sql
stable
security definer
set search_path to ''
as $function$
  with here as (
    select case
      when near_lon is null or near_lat is null then null
      else public.ST_SetSRID(
             public.ST_MakePoint(near_lon, near_lat), 4326
           )::public.geography
    end as spot
  ),
  found as (
    select
      e.id,
      e.title,
      e.type::text as kind,
      e.start_year, e.start_month, e.start_day, e.start_approx,
      e.end_year, e.end_month, e.end_day, e.end_approx,
      e.longitude, e.latitude,
      (
        select p.storage_path from public.event_photos p
        where p.event_id = e.id order by p.position limit 1
      ) as cover_path,
      pr.handle as author,
      e.stars,
      e.user_id = auth.uid() as mine,
      exists (
        select 1 from public.copies c
        where c.kind = 'event' and c.source_id = e.id and c.user_id = auth.uid()
      ) as copied,
      exists (
        select 1 from public.reports r
        where r.kind = 'event' and r.source_id = e.id
          and r.reporter = auth.uid()
      ) as reported,
      case sort
        when 'recent' then extract(epoch from e.created_at)
        else e.stars::double precision
      end as rank
    from public.events e
    join public.profiles pr on pr.user_id = e.user_id
    where e.shared
      and not exists (
        select 1 from public.withheld w
        where w.kind = 'event' and w.source_id = e.id
      )
      and not exists (
        select 1 from public.blocks b
        where (b.user_id = auth.uid() and b.blocked = e.user_id)
           or (b.user_id = e.user_id and b.blocked = auth.uid())
      )
      and (
        words is null or btrim(words) = ''
        or coalesce((
          select bool_and(public.plain(e.title) like '%' || word || '%')
          from unnest(
                 string_to_array(public.plain(btrim(words)), ' ')
               ) as word
          where word <> ''
        ), true)
      )
      -- An overlap, not a containment: a war from 1914 to 1918 belongs to a
      -- search for 1916 as much as to one for the whole decade.
      and (to_key is null or e.from_key <= to_key)
      and (from_key is null or e.to_key >= from_key)
      and (
        (select h.spot from here h) is null or within_m is null
        or public.ST_DWithin(e.spot, (select h.spot from here h), within_m)
      )
  )
  select
    f.id, f.title, f.kind,
    f.start_year, f.start_month, f.start_day, f.start_approx,
    f.end_year, f.end_month, f.end_day, f.end_approx,
    f.longitude, f.latitude,
    f.cover_path, f.author, f.stars, f.mine, f.copied, f.reported, f.rank
  from found f
  where after_rank is null or after_id is null
     or (f.rank, f.id) < (after_rank, after_id)
  order by f.rank desc, f.id desc
  limit least(greatest(coalesce(page_size, 30), 1), 100);
$function$;

/** The same, for people. A life is a span like an event's. */
create or replace function public.search_characters(
  words text default null,
  from_key numeric default null,
  to_key numeric default null,
  near_lon double precision default null,
  near_lat double precision default null,
  within_m double precision default null,
  sort text default 'stars',
  page_size integer default 30,
  after_rank double precision default null,
  after_id uuid default null
)
returns table (
  id uuid,
  title text,
  kind text,
  start_year integer,
  start_month smallint,
  start_day smallint,
  start_approx boolean,
  end_year integer,
  end_month smallint,
  end_day smallint,
  end_approx boolean,
  longitude double precision,
  latitude double precision,
  cover_path text,
  author text,
  stars integer,
  mine boolean,
  copied boolean,
  reported boolean,
  rank double precision
)
language sql
stable
security definer
set search_path to ''
as $function$
  with here as (
    select case
      when near_lon is null or near_lat is null then null
      else public.ST_SetSRID(
             public.ST_MakePoint(near_lon, near_lat), 4326
           )::public.geography
    end as spot
  ),
  found as (
    select
      c.id,
      c.name as title,
      'character'::text as kind,
      c.birth_year as start_year,
      c.birth_month as start_month,
      c.birth_day as start_day,
      c.birth_approx as start_approx,
      c.death_year as end_year,
      c.death_month as end_month,
      c.death_day as end_day,
      c.death_approx as end_approx,
      c.longitude,
      c.latitude,
      (
        select p.storage_path from public.character_photos p
        where p.character_id = c.id order by p.position limit 1
      ) as cover_path,
      pr.handle as author,
      c.stars,
      c.user_id = auth.uid() as mine,
      exists (
        select 1 from public.copies k
        where k.kind = 'character' and k.source_id = c.id
          and k.user_id = auth.uid()
      ) as copied,
      exists (
        select 1 from public.reports r
        where r.kind = 'character' and r.source_id = c.id
          and r.reporter = auth.uid()
      ) as reported,
      case sort
        when 'recent' then extract(epoch from c.created_at)
        else c.stars::double precision
      end as rank
    from public.characters c
    join public.profiles pr on pr.user_id = c.user_id
    where c.shared
      and not exists (
        select 1 from public.withheld w
        where w.kind = 'character' and w.source_id = c.id
      )
      and not exists (
        select 1 from public.blocks b
        where (b.user_id = auth.uid() and b.blocked = c.user_id)
           or (b.user_id = c.user_id and b.blocked = auth.uid())
      )
      and (
        words is null or btrim(words) = ''
        or coalesce((
          select bool_and(public.plain(c.name) like '%' || word || '%')
          from unnest(
                 string_to_array(public.plain(btrim(words)), ' ')
               ) as word
          where word <> ''
        ), true)
      )
      -- Somebody with no birth cannot be placed in time at all, so a period
      -- asked for leaves them out. A death nobody wrote down leaves the span
      -- open, which is the reading the map makes too.
      and (to_key is null or (c.from_key is not null and c.from_key <= to_key))
      and (from_key is null or c.to_key is null or c.to_key >= from_key)
      and (
        (select h.spot from here h) is null or within_m is null
        or public.ST_DWithin(c.spot, (select h.spot from here h), within_m)
      )
  )
  select
    f.id, f.title, f.kind,
    f.start_year, f.start_month, f.start_day, f.start_approx,
    f.end_year, f.end_month, f.end_day, f.end_approx,
    f.longitude, f.latitude,
    f.cover_path, f.author, f.stars, f.mine, f.copied, f.reported, f.rank
  from found f
  where after_rank is null or after_id is null
     or (f.rank, f.id) < (after_rank, after_id)
  order by f.rank desc, f.id desc
  limit least(greatest(coalesce(page_size, 30), 1), 100);
$function$;

revoke execute on function public.search_events(
  text, numeric, numeric, double precision, double precision, double precision,
  text, integer, double precision, uuid) from public, anon;
revoke execute on function public.search_characters(
  text, numeric, numeric, double precision, double precision, double precision,
  text, integer, double precision, uuid) from public, anon;;
