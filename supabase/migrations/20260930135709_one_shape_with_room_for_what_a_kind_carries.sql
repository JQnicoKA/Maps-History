-- A slot for the one extra fact a kind has to offer.
--
-- The five searches hand back the same shape so that one panel can list them
-- all. Four of the five fit: a name, a span, a place, an author, a count of
-- stars. A classeur does not — what a reader needs to know about it before
-- taking it is **how many events come with it** — and a tree will not either,
-- being so many people across so many generations.
--
-- `note` is that slot: a line the kind writes for itself, empty where there
-- is nothing to add. Squeezing it into `badge`, which carries an event's
-- type, would have made one column mean two things.

create or replace function public.search_events(
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
      e.id, e.title, e.type::text as kind, null::text as note,
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
          from unnest(string_to_array(public.plain(btrim(words)), ' ')) as word
          where word <> ''
        ), true)
      )
      and (until is null or e.from_key <= until)
      and (since is null or e.to_key >= since)
      and (
        (select h.spot from here h) is null or within_m is null
        or public.ST_DWithin(e.spot, (select h.spot from here h), within_m)
      )
  )
  select
    f.id, f.title, f.kind, f.note,
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

create or replace function public.search_characters(
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
      c.id, c.name as title, 'character'::text as kind, null::text as note,
      c.birth_year as start_year, c.birth_month as start_month,
      c.birth_day as start_day, c.birth_approx as start_approx,
      c.death_year as end_year, c.death_month as end_month,
      c.death_day as end_day, c.death_approx as end_approx,
      c.longitude, c.latitude,
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
          from unnest(string_to_array(public.plain(btrim(words)), ' ')) as word
          where word <> ''
        ), true)
      )
      and (until is null or (c.from_key is not null and c.from_key <= until))
      and (since is null or c.to_key is null or c.to_key >= since)
      and (
        (select h.spot from here h) is null or within_m is null
        or public.ST_DWithin(c.spot, (select h.spot from here h), within_m)
      )
  )
  select
    f.id, f.title, f.kind, f.note,
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

create or replace function public.events_like(
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
    e.id, e.title, e.type::text, null::text,
    e.start_year, e.start_month, e.start_day, e.start_approx,
    e.end_year, e.end_month, e.end_day, e.end_approx,
    e.longitude, e.latitude,
    (
      select p.storage_path from public.event_photos p
      where p.event_id = e.id order by p.position limit 1
    ),
    pr.handle, e.stars,
    e.user_id = auth.uid(),
    exists (
      select 1 from public.copies c
      where c.kind = 'event' and c.source_id = e.id and c.user_id = auth.uid()
    ),
    exists (
      select 1 from public.reports r
      where r.kind = 'event' and r.source_id = e.id and r.reporter = auth.uid()
    ),
    extensions.word_similarity(public.plain(said), public.plain(e.title))::double precision
  from public.events e
  join public.profiles pr on pr.user_id = e.user_id
  where e.shared
    and btrim(coalesce(said, '')) <> ''
    and at_year is not null
    and not exists (
      select 1 from public.withheld w
      where w.kind = 'event' and w.source_id = e.id
    )
    and not exists (
      select 1 from public.blocks b
      where (b.user_id = auth.uid() and b.blocked = e.user_id)
         or (b.user_id = e.user_id and b.blocked = auth.uid())
    )
    and extensions.word_similarity(public.plain(said), public.plain(e.title)) >= 0.8
    and abs(e.start_year - at_year) <= case
      when fuzzy or e.start_approx then 25 else 2
    end
  order by e.stars desc,
           extensions.word_similarity(public.plain(said), public.plain(e.title)) desc,
           e.id desc
  limit 5;
$function$;

create or replace function public.characters_like(
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
    c.id, c.name, 'character'::text, null::text,
    c.birth_year, c.birth_month, c.birth_day, c.birth_approx,
    c.death_year, c.death_month, c.death_day, c.death_approx,
    c.longitude, c.latitude,
    (
      select p.storage_path from public.character_photos p
      where p.character_id = c.id order by p.position limit 1
    ),
    pr.handle, c.stars,
    c.user_id = auth.uid(),
    exists (
      select 1 from public.copies k
      where k.kind = 'character' and k.source_id = c.id
        and k.user_id = auth.uid()
    ),
    exists (
      select 1 from public.reports r
      where r.kind = 'character' and r.source_id = c.id
        and r.reporter = auth.uid()
    ),
    extensions.word_similarity(public.plain(said), public.plain(c.name))::double precision
  from public.characters c
  join public.profiles pr on pr.user_id = c.user_id
  where c.shared
    and btrim(coalesce(said, '')) <> ''
    and at_year is not null
    and c.birth_year is not null
    and not exists (
      select 1 from public.withheld w
      where w.kind = 'character' and w.source_id = c.id
    )
    and not exists (
      select 1 from public.blocks b
      where (b.user_id = auth.uid() and b.blocked = c.user_id)
         or (b.user_id = c.user_id and b.blocked = auth.uid())
    )
    and extensions.word_similarity(public.plain(said), public.plain(c.name)) >= 0.6
    and abs(c.birth_year - at_year) <= case
      when fuzzy or c.birth_approx then 25 else 2
    end
  order by c.stars desc,
           extensions.word_similarity(public.plain(said), public.plain(c.name)) desc,
           c.id desc
  limit 5;
$function$;

revoke execute on function public.search_events(
  text, numeric, numeric, double precision, double precision, double precision,
  text, integer, double precision, uuid) from public, anon;
revoke execute on function public.search_characters(
  text, numeric, numeric, double precision, double precision, double precision,
  text, integer, double precision, uuid) from public, anon;
revoke execute on function public.events_like(text, integer, boolean)
  from public, anon;
revoke execute on function public.characters_like(text, integer, boolean)
  from public, anon;;
