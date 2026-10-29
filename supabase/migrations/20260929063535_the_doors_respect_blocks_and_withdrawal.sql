/**
 * Blocks the author of something, without ever naming them to the caller.
 *
 * The catalogue hands out pseudonyms and nothing else, and it should stay
 * that way: an application that knew the identifier behind every
 * contribution could build a map of who wrote what across accounts. So the
 * block is asked for by pointing at the work, and the database resolves the
 * person.
 */
create or replace function public.block_author(kind text, source_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  me uuid := auth.uid();
  them uuid;
begin
  if me is null then
    raise exception 'Il faut être connecté.';
  end if;

  case kind
    when 'event' then
      select e.user_id into them from public.events e where e.id = source_id;
    when 'folder' then
      select f.user_id into them from public.folders f where f.id = source_id;
    when 'character' then
      select c.user_id into them from public.characters c where c.id = source_id;
    when 'tree' then
      select t.user_id into them from public.trees t where t.id = source_id;
    when 'territory' then
      select d.user_id into them
      from public.drawn_polities d where d.id = source_id;
  end case;

  if them is null or them = me then
    return;
  end if;

  insert into public.blocks (user_id, blocked) values (me, them)
  on conflict do nothing;
end;
$function$;

/** Who this reader has blocked, so the list can be undone one by one. */
create or replace function public.blocked_people()
returns table (id uuid, handle text)
language sql
stable
security definer
set search_path to ''
as $function$
  select b.blocked, pr.handle
  from public.blocks b
  join public.profiles pr on pr.user_id = b.blocked
  where b.user_id = auth.uid()
  order by pr.handle;
$function$;

revoke execute on function public.block_author(text, uuid) from public, anon;
revoke execute on function public.blocked_people() from public, anon;

/**
 * The catalogue, now with the two things that keep it liveable.
 *
 * **Withheld** rows are gone for everyone, their owner's `shared` flag
 * notwithstanding — that is the whole point of a table the owner cannot
 * write. **Blocked** works both ways: blocking somebody takes their work out
 * of your catalogue *and* yours out of theirs. One-way blocking leaves the
 * blocked reader free to follow what the other writes, which is precisely
 * the behaviour a block is meant to stop.
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
        or public.plain(e.title) like '%' || public.plain(btrim(words)) || '%'
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
) from public, anon;

/** The same three refusals, for the card that shows one whole. */
create or replace function public.shared_event(wanted uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select jsonb_build_object(
    'id', e.id,
    'title', e.title,
    'type', e.type::text,
    'description', e.description,
    'start_year', e.start_year, 'start_month', e.start_month,
    'start_day', e.start_day, 'start_approx', e.start_approx,
    'end_year', e.end_year, 'end_month', e.end_month,
    'end_day', e.end_day, 'end_approx', e.end_approx,
    'longitude', e.longitude, 'latitude', e.latitude,
    'author', pr.handle,
    'stars', e.stars,
    'mine', e.user_id = auth.uid(),
    'copied', exists (
      select 1 from public.copies c
      where c.kind = 'event' and c.source_id = e.id and c.user_id = auth.uid()
    ),
    'reported', exists (
      select 1 from public.reports r
      where r.kind = 'event' and r.source_id = e.id and r.reporter = auth.uid()
    ),
    'photos', coalesce((
      select jsonb_agg(
               jsonb_build_object('path', p.storage_path, 'source', p.source)
               order by p.position)
      from public.event_photos p where p.event_id = e.id
    ), '[]'::jsonb),
    'cast', coalesce((
      select jsonb_agg(ch.name order by ch.name)
      from public.event_characters ec
      join public.characters ch on ch.id = ec.character_id
      where ec.event_id = e.id
    ), '[]'::jsonb),
    'folders', coalesce((
      select jsonb_agg(f.name order by f.name)
      from public.event_folders ef
      join public.folders f on f.id = ef.folder_id
      where ef.event_id = e.id
    ), '[]'::jsonb)
  )
  from public.events e
  join public.profiles pr on pr.user_id = e.user_id
  where e.id = wanted
    and e.shared
    and not exists (
      select 1 from public.withheld w
      where w.kind = 'event' and w.source_id = e.id
    )
    and not exists (
      select 1 from public.blocks b
      where (b.user_id = auth.uid() and b.blocked = e.user_id)
         or (b.user_id = e.user_id and b.blocked = auth.uid())
    );
$function$;

/** And for taking a copy of one. */
create or replace function public.copy_event(wanted uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  me uuid := auth.uid();
  source public.events%rowtype;
  made uuid;
  character_row record;
  already uuid;
  mine_now uuid;
begin
  if me is null then
    raise exception 'Il faut être connecté.';
  end if;

  select * into source
  from public.events e
  where e.id = wanted
    and e.shared
    and not exists (
      select 1 from public.withheld w
      where w.kind = 'event' and w.source_id = e.id
    )
    and not exists (
      select 1 from public.blocks b
      where (b.user_id = me and b.blocked = e.user_id)
         or (b.user_id = e.user_id and b.blocked = me)
    );
  if not found then
    raise exception 'Cet événement n''est plus partagé.';
  end if;
  if source.user_id = me then
    raise exception 'Cet événement est déjà le vôtre.';
  end if;

  select e.id into made
  from public.events e
  where e.user_id = me and e.origin_id = source.id
  limit 1;
  if made is not null then
    return made;
  end if;

  insert into public.events (
    user_id, title, description, type,
    start_year, start_month, start_day, start_approx,
    end_year, end_month, end_day, end_approx,
    longitude, latitude, shared, origin_id
  ) values (
    me, source.title, source.description, source.type,
    source.start_year, source.start_month, source.start_day, source.start_approx,
    source.end_year, source.end_month, source.end_day, source.end_approx,
    source.longitude, source.latitude, false, source.id
  ) returning id into made;

  insert into public.event_photos (event_id, storage_path, position, source)
  select made, p.storage_path, p.position, p.source
  from public.event_photos p where p.event_id = source.id;

  for character_row in
    select ch.*
    from public.event_characters ec
    join public.characters ch on ch.id = ec.character_id
    where ec.event_id = source.id
  loop
    select c.id into already
    from public.characters c
    where c.user_id = me
      and (c.origin_id = character_row.id or c.id = character_row.id)
    limit 1;

    if already is null then
      insert into public.characters (
        user_id, name, bio,
        birth_year, birth_month, birth_day, birth_approx,
        death_year, death_month, death_day, death_approx,
        longitude, latitude, shared, origin_id
      ) values (
        me, character_row.name, character_row.bio,
        character_row.birth_year, character_row.birth_month,
        character_row.birth_day, character_row.birth_approx,
        character_row.death_year, character_row.death_month,
        character_row.death_day, character_row.death_approx,
        character_row.longitude, character_row.latitude, false, character_row.id
      ) returning id into mine_now;

      insert into public.character_photos (character_id, storage_path, position, source)
      select mine_now, cp.storage_path, cp.position, cp.source
      from public.character_photos cp where cp.character_id = character_row.id;
    else
      mine_now := already;
    end if;

    insert into public.event_characters (event_id, character_id)
    values (made, mine_now) on conflict do nothing;
  end loop;

  insert into public.copies (kind, source_id, user_id)
  values ('event', source.id, me) on conflict do nothing;

  return made;
end;
$function$;

revoke execute on function public.shared_event(uuid) from public, anon;
revoke execute on function public.copy_event(uuid) from public, anon;;
