-- The outline travels with the row, and that buys two things at once.
--
-- A tap on a territory goes straight to the map — no card in between, since a
-- card has nothing to say about a shape — and it can go without a second
-- query, the shape being already in hand. And the list can draw a thumbnail
-- of it, which is the only picture a territory has.
--
-- Simplified to a tenth of a degree, about ten kilometres, and written with
-- two decimals: far coarser than the card's own preview, and that is the
-- point — a page of twenty-four of these has to stay small.
--
-- The four other searches return one column fewer. Nothing reads a row
-- positionally, so a kind that has something the others do not may say so.
create or replace function public.search_territories(
  words text default null,
  since numeric default null,
  until numeric default null,
  near_lon double precision default null,
  near_lat double precision default null,
  within_m double precision default null,
  sort text default 'stars',
  page_size integer default 30,
  after_rank double precision default null,
  after_id uuid default null
)
returns table (
  id uuid, title text, kind text, note text,
  start_year integer, start_month smallint, start_day smallint,
  start_approx boolean,
  end_year integer, end_month smallint, end_day smallint, end_approx boolean,
  longitude double precision, latitude double precision,
  cover_path text, author text, stars integer,
  mine boolean, copied boolean, reported boolean, rank double precision,
  shape jsonb
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
      d.id,
      d.name as title,
      'territory'::text as kind,
      public.extent_said(d.geom) as note,
      d.start_year, null::smallint as start_month, null::smallint as start_day,
      false as start_approx,
      d.end_year, null::smallint as end_month, null::smallint as end_day,
      false as end_approx,
      public.ST_X(coalesce(d.anchor, public.ST_Centroid(d.geom))) as longitude,
      public.ST_Y(coalesce(d.anchor, public.ST_Centroid(d.geom))) as latitude,
      null::text as cover_path,
      pr.handle as author,
      d.stars,
      d.user_id = auth.uid() as mine,
      exists (
        select 1 from public.copies c
        where c.kind = 'territory' and c.source_id = d.id
          and c.user_id = auth.uid()
      ) as copied,
      exists (
        select 1 from public.reports r
        where r.kind = 'territory' and r.source_id = d.id
          and r.reporter = auth.uid()
      ) as reported,
      case sort
        when 'recent' then extract(epoch from d.created_at)
        else d.stars::double precision
      end as rank,
      public.ST_AsGeoJSON(
        public.ST_SimplifyPreserveTopology(d.geom, 0.1), 2
      )::jsonb as shape
    from public.drawn_polities d
    join public.profiles pr on pr.user_id = d.user_id
    where d.shared
      and not exists (
        select 1 from public.withheld w
        where w.kind = 'territory' and w.source_id = d.id
      )
      and not exists (
        select 1 from public.blocks b
        where (b.user_id = auth.uid() and b.blocked = d.user_id)
           or (b.user_id = d.user_id and b.blocked = auth.uid())
      )
      and (
        words is null or btrim(words) = ''
        or coalesce((
          select bool_and(public.plain(d.name) like '%' || word || '%')
          from unnest(string_to_array(public.plain(btrim(words)), ' ')) as word
          where word <> ''
        ), true)
      )
      and (until is null or d.start_year <= until)
      and (since is null or d.end_year >= since)
      and (
        (select h.spot from here h) is null or within_m is null
        or public.ST_DWithin(
             coalesce(d.anchor, public.ST_Centroid(d.geom))::public.geography,
             (select h.spot from here h),
             within_m
           )
      )
  )
  select
    q.id, q.title, q.kind, q.note,
    q.start_year, q.start_month, q.start_day, q.start_approx,
    q.end_year, q.end_month, q.end_day, q.end_approx,
    q.longitude, q.latitude,
    q.cover_path, q.author, q.stars, q.mine, q.copied, q.reported, q.rank,
    q.shape
  from found q
  where after_rank is null or after_id is null
     or (q.rank, q.id) < (after_rank, after_id)
  order by q.rank desc, q.id desc
  limit least(greatest(coalesce(page_size, 30), 1), 100);
$function$;

revoke execute on function public.search_territories(
  text, numeric, numeric, double precision, double precision, double precision,
  text, integer, double precision, uuid) from public, anon;;
