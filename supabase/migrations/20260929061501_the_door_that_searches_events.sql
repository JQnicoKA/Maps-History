/**
 * The catalogue of events, as one page of it.
 *
 * **A door, not an opening.** Row-level security on `events` is untouched:
 * every ordinary query in the application still sees only its own reader's
 * rows, and nothing in the twenty-odd places that read the collection has to
 * be re-checked. What the community may see comes through here and through
 * its two companions, which are short enough to audit line by line.
 *
 * Three things follow from that and are worth stating:
 *
 * - it returns only rows whose owner marked them `shared`;
 * - it never takes an account as an argument — whose page this is comes from
 *   the token, so no caller can ask for somebody else's view;
 * - it carries the author's **pseudonym** and nothing else about them.
 *
 * One's own contributions are listed too, marked `mine`. Hiding them would
 * leave an author unable to see how their work appears, which is the first
 * thing anybody wants to check.
 *
 * Paging is by keyset — a rank and an id, handed back from the last row of
 * the previous page — so the three orderings share one shape. The rank is
 * always descending: stars as they are, recency as an epoch, and nearness as
 * a negative distance.
 */
create or replace function public.search_events(
  words text default null,
  from_year integer default null,
  to_year integer default null,
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
      e.start_year,
      e.start_month,
      e.start_day,
      e.start_approx,
      e.end_year,
      e.end_month,
      e.end_day,
      e.end_approx,
      e.longitude,
      e.latitude,
      (
        select p.storage_path
        from public.event_photos p
        where p.event_id = e.id
        order by p.position
        limit 1
      ) as cover_path,
      pr.handle as author,
      e.stars,
      e.user_id = auth.uid() as mine,
      exists (
        select 1
        from public.copies c
        where c.kind = 'event'
          and c.source_id = e.id
          and c.user_id = auth.uid()
      ) as copied,
      case sort
        when 'recent' then extract(epoch from e.created_at)
        when 'near' then
          -public.ST_Distance(e.spot, (select h.spot from here h))
        else e.stars::double precision
      end as rank
    from public.events e
    join public.profiles pr on pr.user_id = e.user_id
    where e.shared
      and (
        words is null or btrim(words) = ''
        or public.plain(e.title) like '%' || public.plain(btrim(words)) || '%'
      )
      -- An overlap, not a containment: a war from 1914 to 1918 belongs to a
      -- search for 1916 as much as to one for the whole decade.
      and (to_year is null or e.start_year <= to_year)
      and (from_year is null or coalesce(e.end_year, e.start_year) >= from_year)
      and (
        (select h.spot from here h) is null
        or within_m is null
        or public.ST_DWithin(e.spot, (select h.spot from here h), within_m)
      )
  )
  select
    f.id, f.title, f.kind,
    f.start_year, f.start_month, f.start_day, f.start_approx,
    f.end_year, f.end_month, f.end_day, f.end_approx,
    f.longitude, f.latitude,
    f.cover_path, f.author, f.stars, f.mine, f.copied, f.rank
  from found f
  where after_rank is null
     or after_id is null
     or (f.rank, f.id) < (after_rank, after_id)
  order by f.rank desc, f.id desc
  limit least(greatest(coalesce(page_size, 30), 1), 100);
$function$;

revoke execute on function public.search_events(
  text, integer, integer, double precision, double precision, double precision,
  text, integer, double precision, uuid
) from public, anon;;
