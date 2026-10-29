/**
 * The catalogue of people, as one page of it.
 *
 * The same door as `search_events`, for the same reasons and with the same
 * three rules: shared only, no account taken as an argument, nothing about
 * the author but their pseudonym. Withheld rows are gone for everyone;
 * blocking works both ways.
 *
 * A life is a span like an event's, so the columns are the same ones — birth
 * where an event has its start, death where it has its end. An unknown death
 * leaves the span open, which is the same reading the map uses: a death one
 * has not written down is a death one does not know.
 */
create or replace function public.search_characters(
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
        when 'near' then -public.ST_Distance(c.spot, (select h.spot from here h))
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
      and (to_year is null or c.birth_year is null or c.birth_year <= to_year)
      and (from_year is null or c.death_year is null or c.death_year >= from_year)
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

/**
 * One shared person, whole — what the card shows before anybody takes them.
 *
 * The events come as titles and the trees as names: a reader looking at
 * somebody else's Clovis wants to know what that Clovis was mixed up in, not
 * the identifiers of rows they will never hold. Copying brings the person,
 * never the author's events.
 */
create or replace function public.shared_character(wanted uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select jsonb_build_object(
    'id', c.id,
    'title', c.name,
    'type', 'character',
    'description', c.bio,
    'start_year', c.birth_year, 'start_month', c.birth_month,
    'start_day', c.birth_day, 'start_approx', c.birth_approx,
    'end_year', c.death_year, 'end_month', c.death_month,
    'end_day', c.death_day, 'end_approx', c.death_approx,
    'longitude', c.longitude, 'latitude', c.latitude,
    'author', pr.handle,
    'stars', c.stars,
    'mine', c.user_id = auth.uid(),
    'copied', exists (
      select 1 from public.copies k
      where k.kind = 'character' and k.source_id = c.id
        and k.user_id = auth.uid()
    ),
    'reported', exists (
      select 1 from public.reports r
      where r.kind = 'character' and r.source_id = c.id
        and r.reporter = auth.uid()
    ),
    'photos', coalesce((
      select jsonb_agg(
               jsonb_build_object('path', p.storage_path, 'source', p.source)
               order by p.position)
      from public.character_photos p where p.character_id = c.id
    ), '[]'::jsonb),
    'cast', coalesce((
      select jsonb_agg(e.title order by e.start_year)
      from public.event_characters ec
      join public.events e on e.id = ec.event_id
      where ec.character_id = c.id and e.shared
    ), '[]'::jsonb),
    'folders', coalesce((
      select jsonb_agg(distinct t.name)
      from public.tree_members m
      join public.trees t on t.id = m.tree_id
      where m.character_id = c.id and t.shared
    ), '[]'::jsonb)
  )
  from public.characters c
  join public.profiles pr on pr.user_id = c.user_id
  where c.id = wanted
    and c.shared
    and not exists (
      select 1 from public.withheld w
      where w.kind = 'character' and w.source_id = c.id
    )
    and not exists (
      select 1 from public.blocks b
      where (b.user_id = auth.uid() and b.blocked = c.user_id)
         or (b.user_id = c.user_id and b.blocked = auth.uid())
    );
$function$;

/**
 * Takes a copy of somebody's person into the caller's collection.
 *
 * Simpler than an event: a person hangs from nothing. The portraits' rows
 * come along pointing at the author's files, and the application walks the
 * files over afterwards — storage is not reachable from SQL.
 *
 * Idempotent, and not shared. One Clovis in the catalogue with a hundred
 * stars beats a hundred Clovis with one.
 */
create or replace function public.copy_character(wanted uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  me uuid := auth.uid();
  source public.characters%rowtype;
  made uuid;
begin
  if me is null then
    raise exception 'Il faut être connecté.';
  end if;

  select * into source
  from public.characters c
  where c.id = wanted
    and c.shared
    and not exists (
      select 1 from public.withheld w
      where w.kind = 'character' and w.source_id = c.id
    )
    and not exists (
      select 1 from public.blocks b
      where (b.user_id = me and b.blocked = c.user_id)
         or (b.user_id = c.user_id and b.blocked = me)
    );
  if not found then
    raise exception 'Ce personnage n''est plus partagé.';
  end if;
  if source.user_id = me then
    raise exception 'Ce personnage est déjà le vôtre.';
  end if;

  select c.id into made
  from public.characters c
  where c.user_id = me and c.origin_id = source.id
  limit 1;
  if made is not null then
    return made;
  end if;

  insert into public.characters (
    user_id, name, bio,
    birth_year, birth_month, birth_day, birth_approx,
    death_year, death_month, death_day, death_approx,
    longitude, latitude, shared, origin_id
  ) values (
    me, source.name, source.bio,
    source.birth_year, source.birth_month, source.birth_day, source.birth_approx,
    source.death_year, source.death_month, source.death_day, source.death_approx,
    source.longitude, source.latitude, false, source.id
  ) returning id into made;

  insert into public.character_photos (character_id, storage_path, position, source)
  select made, p.storage_path, p.position, p.source
  from public.character_photos p where p.character_id = source.id;

  insert into public.copies (kind, source_id, user_id)
  values ('character', source.id, me) on conflict do nothing;

  return made;
end;
$function$;

/**
 * People who look like the one being written — asked once a birth is known.
 *
 * The same reasoning as `events_like`, and it matters more here: a historical
 * person has one identity, so two readers writing "Clovis" are writing about
 * the same man, whereas two readers writing "Bataille de Vouillé" might not
 * be. The birth year is still what separates the homonyms — and history is
 * even fuller of those among people than among events.
 */
create or replace function public.characters_like(
  said text,
  at_year integer,
  fuzzy boolean default false
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
  select
    c.id,
    c.name,
    'character'::text,
    c.birth_year, c.birth_month, c.birth_day, c.birth_approx,
    c.death_year, c.death_month, c.death_day, c.death_approx,
    c.longitude, c.latitude,
    (
      select p.storage_path from public.character_photos p
      where p.character_id = c.id order by p.position limit 1
    ),
    pr.handle,
    c.stars,
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
    and extensions.word_similarity(public.plain(said), public.plain(c.name)) >= 0.8
    and abs(c.birth_year - at_year) <= case
      when fuzzy or c.birth_approx then 25 else 2
    end
  order by c.stars desc,
           extensions.word_similarity(public.plain(said), public.plain(c.name)) desc,
           c.id desc
  limit 5;
$function$;

revoke execute on function public.search_characters(
  text, integer, integer, double precision, double precision, double precision,
  text, integer, double precision, uuid
) from public, anon;
revoke execute on function public.shared_character(uuid) from public, anon;
revoke execute on function public.copy_character(uuid) from public, anon;
revoke execute on function public.characters_like(text, integer, boolean)
  from public, anon;;
