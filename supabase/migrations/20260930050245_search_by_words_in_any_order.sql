-- "marignan bataille" found nothing, "bataille de marignan" found it.
--
-- The catalogue matched the typed text as one substring of the title, which
-- means it also demanded the reader's word order. Now every word must appear
-- and none of them has a place to be in. Still substrings, so a half-typed
-- word keeps working — "vouil" finds Vouillé — and still the trigram index,
-- which serves each LIKE in turn.
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
        when 'near' then -public.ST_Distance(e.spot, (select h.spot from here h))
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
      and (to_year is null or e.start_year <= to_year)
      and (from_year is null or coalesce(e.end_year, e.start_year) >= from_year)
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

revoke execute on function public.search_events(
  text, integer, integer, double precision, double precision, double precision,
  text, integer, double precision, uuid
) from public, anon;;
