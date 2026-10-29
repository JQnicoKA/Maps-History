create index drawn_shared_name_idx on public.drawn_polities
  using gin (public.plain(name) extensions.gin_trgm_ops) where shared;
create index drawn_shared_stars_idx on public.drawn_polities (stars desc, id desc)
  where shared;
create index drawn_shared_recent_idx on public.drawn_polities (created_at desc, id desc)
  where shared;
create index drawn_shared_anchor_idx on public.drawn_polities using gist (anchor)
  where shared;

/**
 * How big a painted territory is, said the way an atlas would.
 *
 * Computed from the geometry rather than read from `area`, which the drawing
 * function fills for the label sizing and whose unit is its own business.
 * Square kilometres on the sphere is the one figure a reader can weigh — and
 * it is what `note` carries for this kind, since a territory has no count of
 * anything and its size is what says whether it is a duchy or an empire.
 *
 * The comma in the pattern is literal, so the group separator does not depend
 * on the server's locale; it is then replaced by the space French uses.
 */
create or replace function public.extent_said(shape public.geometry)
returns text
language sql
immutable
parallel safe
set search_path to ''
as $function$
  select case
    when shape is null then null
    else replace(
           to_char(
             round(public.ST_Area(shape::public.geography) / 1000000)::numeric,
             'FM999,999,999'
           ),
           ',', ' '
         ) || ' km²'
  end;
$function$;

/**
 * The catalogue of painted territories.
 *
 * A territory has a name, two years and a shape, and nothing else — no
 * description, no pictures, no cast. So its row leans on what it has: the
 * span it was drawn for, its extent in `note`, and its anchor as the point
 * the region filter measures from. There is no cover; the list draws its
 * initial, and the shape itself is only worth seeing on the map.
 */
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
  mine boolean, copied boolean, reported boolean, rank double precision
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
      end as rank
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
      -- Years only: nobody paints a border to the day.
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
    q.cover_path, q.author, q.stars, q.mine, q.copied, q.reported, q.rank
  from found q
  where after_rank is null or after_id is null
     or (q.rank, q.id) < (after_rank, after_id)
  order by q.rank desc, q.id desc
  limit least(greatest(coalesce(page_size, 30), 1), 100);
$function$;

/**
 * One shared territory, with its shape.
 *
 * The shape is the whole of what there is to judge, so it comes along as
 * GeoJSON for the map to paint — simplified to about two kilometres, which
 * is finer than a finger drew it and a great deal lighter than what the
 * buffering produced.
 */
create or replace function public.shared_territory(wanted uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select jsonb_build_object(
    'id', d.id,
    'title', d.name,
    'type', 'territory',
    'note', public.extent_said(d.geom),
    'description', null,
    'start_year', d.start_year, 'start_month', null,
    'start_day', null, 'start_approx', false,
    'end_year', d.end_year, 'end_month', null,
    'end_day', null, 'end_approx', false,
    'longitude', public.ST_X(coalesce(d.anchor, public.ST_Centroid(d.geom))),
    'latitude', public.ST_Y(coalesce(d.anchor, public.ST_Centroid(d.geom))),
    'author', pr.handle,
    'stars', d.stars,
    'mine', d.user_id = auth.uid(),
    'copied', exists (
      select 1 from public.copies c
      where c.kind = 'territory' and c.source_id = d.id
        and c.user_id = auth.uid()
    ),
    'reported', exists (
      select 1 from public.reports r
      where r.kind = 'territory' and r.source_id = d.id
        and r.reporter = auth.uid()
    ),
    'photos', '[]'::jsonb,
    'cast', '[]'::jsonb,
    'folders', '[]'::jsonb,
    'held', '[]'::jsonb,
    'shape', public.ST_AsGeoJSON(
      public.ST_SimplifyPreserveTopology(d.geom, 0.02)
    )::jsonb
  )
  from public.drawn_polities d
  join public.profiles pr on pr.user_id = d.user_id
  where d.id = wanted
    and d.shared
    and not exists (
      select 1 from public.withheld w
      where w.kind = 'territory' and w.source_id = d.id
    )
    and not exists (
      select 1 from public.blocks b
      where (b.user_id = auth.uid() and b.blocked = d.user_id)
         or (b.user_id = d.user_id and b.blocked = auth.uid())
    );
$function$;

/**
 * Takes a copy of somebody's territory.
 *
 * The simplest of the five: a territory hangs from nothing and carries no
 * pictures. The wash comes with it so the copy is the colour the reader saw,
 * and the anchor so its name sits where its author put it.
 */
create or replace function public.copy_territory(wanted uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  me uuid := auth.uid();
  source public.drawn_polities%rowtype;
  made uuid;
begin
  if me is null then
    raise exception 'Il faut être connecté.';
  end if;

  select * into source
  from public.drawn_polities d
  where d.id = wanted
    and d.shared
    and not exists (
      select 1 from public.withheld w
      where w.kind = 'territory' and w.source_id = d.id
    )
    and not exists (
      select 1 from public.blocks b
      where (b.user_id = me and b.blocked = d.user_id)
         or (b.user_id = d.user_id and b.blocked = me)
    );
  if not found then
    raise exception 'Ce territoire n''est plus partagé.';
  end if;
  if source.user_id = me then
    raise exception 'Ce territoire est déjà le vôtre.';
  end if;

  select d.id into made
  from public.drawn_polities d
  where d.user_id = me and d.origin_id = source.id
  limit 1;
  if made is not null then
    return made;
  end if;

  insert into public.drawn_polities (
    user_id, name, start_year, end_year, wash, anchor, area, geom,
    shared, origin_id
  ) values (
    me, source.name, source.start_year, source.end_year, source.wash,
    source.anchor, source.area, source.geom, false, source.id
  ) returning id into made;

  insert into public.copies (kind, source_id, user_id)
  values ('territory', source.id, me) on conflict do nothing;

  return made;
end;
$function$;

/**
 * Territories that look like the one being named.
 *
 * Names, so the threshold is the one names deserve — 0.6, measured in
 * `characters_like` — and the years are compared as an overlap rather than a
 * distance: two readers painting the Holy Roman Empire will not have chosen
 * the same century to start from, but their spans will meet.
 */
create or replace function public.territories_like(
  said text, at_year integer, fuzzy boolean default false
)
returns table (
  id uuid, title text, kind text, note text,
  start_year integer, start_month smallint, start_day smallint,
  start_approx boolean,
  end_year integer, end_month smallint, end_day smallint, end_approx boolean,
  longitude double precision, latitude double precision,
  cover_path text, author text, stars integer,
  mine boolean, copied boolean, reported boolean, rank double precision
)
language sql
stable
security definer
set search_path to ''
as $function$
  select
    d.id, d.name, 'territory'::text, public.extent_said(d.geom),
    d.start_year, null::smallint, null::smallint, false,
    d.end_year, null::smallint, null::smallint, false,
    public.ST_X(coalesce(d.anchor, public.ST_Centroid(d.geom))),
    public.ST_Y(coalesce(d.anchor, public.ST_Centroid(d.geom))),
    null::text,
    pr.handle, d.stars,
    d.user_id = auth.uid(),
    exists (
      select 1 from public.copies c
      where c.kind = 'territory' and c.source_id = d.id
        and c.user_id = auth.uid()
    ),
    exists (
      select 1 from public.reports r
      where r.kind = 'territory' and r.source_id = d.id
        and r.reporter = auth.uid()
    ),
    extensions.word_similarity(public.plain(said), public.plain(d.name))::double precision
  from public.drawn_polities d
  join public.profiles pr on pr.user_id = d.user_id
  where d.shared
    and btrim(coalesce(said, '')) <> ''
    and at_year is not null
    and not exists (
      select 1 from public.withheld w
      where w.kind = 'territory' and w.source_id = d.id
    )
    and not exists (
      select 1 from public.blocks b
      where (b.user_id = auth.uid() and b.blocked = d.user_id)
         or (b.user_id = d.user_id and b.blocked = auth.uid())
    )
    and extensions.word_similarity(public.plain(said), public.plain(d.name)) >= 0.6
    -- The span the reader is about to draw for, widened a little, has to
    -- meet the span of the one already there.
    and d.start_year <= at_year + case when fuzzy then 200 else 50 end
    and d.end_year >= at_year - case when fuzzy then 200 else 50 end
  order by d.stars desc,
           extensions.word_similarity(public.plain(said), public.plain(d.name)) desc,
           d.id desc
  limit 5;
$function$;

revoke execute on function public.extent_said(public.geometry) from public, anon;
revoke execute on function public.search_territories(
  text, numeric, numeric, double precision, double precision, double precision,
  text, integer, double precision, uuid) from public, anon;
revoke execute on function public.shared_territory(uuid) from public, anon;
revoke execute on function public.copy_territory(uuid) from public, anon;
revoke execute on function public.territories_like(text, integer, boolean)
  from public, anon;;
