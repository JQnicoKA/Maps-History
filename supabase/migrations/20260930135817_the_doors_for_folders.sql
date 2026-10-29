create index folders_shared_name_idx on public.folders
  using gin (public.plain(name) extensions.gin_trgm_ops) where shared;
create index folders_shared_stars_idx on public.folders (stars desc, id desc)
  where shared;
create index folders_shared_recent_idx on public.folders (created_at desc, id desc)
  where shared;

/**
 * Copies one event into an account, and everything it cannot do without.
 *
 * Pulled out of `copy_event` because a classeur is a great many of them, and
 * two copies of this logic would have drifted: the dedup by `origin_id`, the
 * characters coming along, the photo rows pointing at the author's files
 * until the application walks them over.
 *
 * Returns the event this reader now has — the one just made, or the one they
 * already had. Refuses nothing and counts nothing: the public wrappers judge
 * whether the copy is allowed and award the star.
 */
create or replace function public.copy_one_event(source_id uuid, me uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  source public.events%rowtype;
  made uuid;
  character_row record;
  already uuid;
  mine_now uuid;
begin
  select * into source from public.events e where e.id = source_id;
  if not found then
    return null;
  end if;

  -- Theirs already, by either name: the original, or a copy of it.
  select e.id into made
  from public.events e
  where e.user_id = me
    and (e.origin_id = source.id or e.id = source.id)
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

  -- The star belongs to the event whatever route brought the reader to it:
  -- "how many readers have this" is the honest reading, and the key on
  -- `copies` is what keeps it from being counted twice.
  insert into public.copies (kind, source_id, user_id)
  values ('event', source.id, me) on conflict do nothing;

  return made;
end;
$function$;

create or replace function public.copy_event(wanted uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  me uuid := auth.uid();
  owner uuid;
begin
  if me is null then
    raise exception 'Il faut être connecté.';
  end if;

  select e.user_id into owner
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
  if owner is null then
    raise exception 'Cet événement n''est plus partagé.';
  end if;
  if owner = me then
    raise exception 'Cet événement est déjà le vôtre.';
  end if;

  return public.copy_one_event(wanted, me);
end;
$function$;

/**
 * The catalogue of classeurs.
 *
 * A classeur has no date and no place of its own — it takes them from what it
 * holds. So its span is the reach of its events and its point their centre,
 * and `note` says how many come with it, which is the one thing a reader
 * needs before taking a whole subject at once.
 *
 * Only its **shared** events count, in the span as in the number: promising
 * forty and delivering twelve would be worse than promising twelve.
 */
create or replace function public.search_folders(
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
  held as (
    select
      ef.folder_id,
      count(*) as how_many,
      min(e.start_year) as first_year,
      max(coalesce(e.end_year, e.start_year)) as last_year,
      min(e.from_key) as from_key,
      max(e.to_key) as to_key,
      public.ST_SetSRID(
        public.ST_MakePoint(avg(e.longitude), avg(e.latitude)), 4326
      )::public.geography as spot
    from public.event_folders ef
    join public.events e on e.id = ef.event_id
    where e.shared
    group by ef.folder_id
  ),
  found as (
    select
      f.id,
      f.name as title,
      'folder'::text as kind,
      case coalesce(h.how_many, 0)
        when 0 then 'vide'
        when 1 then '1 événement'
        else h.how_many || ' événements'
      end as note,
      h.first_year::integer as start_year,
      null::smallint as start_month,
      null::smallint as start_day,
      false as start_approx,
      h.last_year::integer as end_year,
      null::smallint as end_month,
      null::smallint as end_day,
      false as end_approx,
      public.ST_X(h.spot::public.geometry) as longitude,
      public.ST_Y(h.spot::public.geometry) as latitude,
      coalesce(f.photo_path, (
        select p.storage_path
        from public.event_folders ef
        join public.events e on e.id = ef.event_id
        join public.event_photos p on p.event_id = e.id
        where ef.folder_id = f.id and e.shared
        order by e.start_year, p.position
        limit 1
      )) as cover_path,
      pr.handle as author,
      f.stars,
      f.user_id = auth.uid() as mine,
      exists (
        select 1 from public.copies c
        where c.kind = 'folder' and c.source_id = f.id
          and c.user_id = auth.uid()
      ) as copied,
      exists (
        select 1 from public.reports r
        where r.kind = 'folder' and r.source_id = f.id
          and r.reporter = auth.uid()
      ) as reported,
      case sort
        when 'recent' then extract(epoch from f.created_at)
        else f.stars::double precision
      end as rank
    from public.folders f
    join public.profiles pr on pr.user_id = f.user_id
    left join held h on h.folder_id = f.id
    where f.shared
      and not exists (
        select 1 from public.withheld w
        where w.kind = 'folder' and w.source_id = f.id
      )
      and not exists (
        select 1 from public.blocks b
        where (b.user_id = auth.uid() and b.blocked = f.user_id)
           or (b.user_id = f.user_id and b.blocked = auth.uid())
      )
      and (
        words is null or btrim(words) = ''
        or coalesce((
          select bool_and(public.plain(f.name) like '%' || word || '%')
          from unnest(string_to_array(public.plain(btrim(words)), ' ')) as word
          where word <> ''
        ), true)
      )
      -- An empty classeur sits outside every period and every region: it has
      -- nothing to be near and no century to belong to.
      and (until is null or (h.from_key is not null and h.from_key <= until))
      and (since is null or (h.to_key is not null and h.to_key >= since))
      and (
        (select hh.spot from here hh) is null or within_m is null
        or (
          h.spot is not null
          and public.ST_DWithin(h.spot, (select hh.spot from here hh), within_m)
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

/** One shared classeur, with a look at what is in it. */
create or replace function public.shared_folder(wanted uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select jsonb_build_object(
    'id', f.id,
    'title', f.name,
    'type', 'folder',
    'note', (
      select case count(*)
        when 0 then 'vide'
        when 1 then '1 événement'
        else count(*) || ' événements'
      end
      from public.event_folders ef
      join public.events e on e.id = ef.event_id
      where ef.folder_id = f.id and e.shared
    ),
    'description', null,
    'start_year', (
      select min(e.start_year) from public.event_folders ef
      join public.events e on e.id = ef.event_id
      where ef.folder_id = f.id and e.shared
    ),
    'start_month', null, 'start_day', null, 'start_approx', false,
    'end_year', (
      select max(coalesce(e.end_year, e.start_year))
      from public.event_folders ef
      join public.events e on e.id = ef.event_id
      where ef.folder_id = f.id and e.shared
    ),
    'end_month', null, 'end_day', null, 'end_approx', false,
    'longitude', null, 'latitude', null,
    'author', pr.handle,
    'stars', f.stars,
    'mine', f.user_id = auth.uid(),
    'copied', exists (
      select 1 from public.copies c
      where c.kind = 'folder' and c.source_id = f.id and c.user_id = auth.uid()
    ),
    'reported', exists (
      select 1 from public.reports r
      where r.kind = 'folder' and r.source_id = f.id
        and r.reporter = auth.uid()
    ),
    'photos', case
      when f.photo_path is null then '[]'::jsonb
      else jsonb_build_array(
        jsonb_build_object('path', f.photo_path, 'source', null)
      )
    end,
    -- What is in it, oldest first, capped: a card is a card and forty titles
    -- is a card nobody reads.
    'cast', coalesce((
      select jsonb_agg(one.title order by one.start_year)
      from (
        select e.title, e.start_year
        from public.event_folders ef
        join public.events e on e.id = ef.event_id
        where ef.folder_id = f.id and e.shared
        order by e.start_year
        limit 25
      ) one
    ), '[]'::jsonb),
    'folders', '[]'::jsonb
  )
  from public.folders f
  join public.profiles pr on pr.user_id = f.user_id
  where f.id = wanted
    and f.shared
    and not exists (
      select 1 from public.withheld w
      where w.kind = 'folder' and w.source_id = f.id
    )
    and not exists (
      select 1 from public.blocks b
      where (b.user_id = auth.uid() and b.blocked = f.user_id)
         or (b.user_id = f.user_id and b.blocked = auth.uid())
    );
$function$;

/**
 * Takes a classeur, and the events filed in it.
 *
 * A classeur without its events is an empty box with a name on it, so the
 * events come too — each through `copy_one_event`, which means the characters
 * come with them and nothing arrives twice. Their **importance within the
 * classeur** is carried over, since that pairing is the whole point of the
 * model.
 *
 * Capped at two hundred, and it raises rather than silently truncating: a
 * classeur of a thousand events would run past the statement timeout, and a
 * box that quietly arrived half full would be worse than a refusal that says
 * to take the events one by one.
 */
create or replace function public.copy_folder(wanted uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  me uuid := auth.uid();
  source public.folders%rowtype;
  made uuid;
  how_many integer;
  link record;
  theirs uuid;
begin
  if me is null then
    raise exception 'Il faut être connecté.';
  end if;

  select * into source
  from public.folders f
  where f.id = wanted
    and f.shared
    and not exists (
      select 1 from public.withheld w
      where w.kind = 'folder' and w.source_id = f.id
    )
    and not exists (
      select 1 from public.blocks b
      where (b.user_id = me and b.blocked = f.user_id)
         or (b.user_id = f.user_id and b.blocked = me)
    );
  if not found then
    raise exception 'Ce classeur n''est plus partagé.';
  end if;
  if source.user_id = me then
    raise exception 'Ce classeur est déjà le vôtre.';
  end if;

  select f.id into made
  from public.folders f
  where f.user_id = me and f.origin_id = source.id
  limit 1;
  if made is not null then
    return made;
  end if;

  select count(*) into how_many
  from public.event_folders ef
  join public.events e on e.id = ef.event_id
  where ef.folder_id = source.id and e.shared;

  if how_many > 200 then
    raise exception
      'Ce classeur contient % événements, trop pour une seule copie. Prenez ceux qui vous intéressent un par un.',
      how_many;
  end if;

  -- A name is unique per account, so a reader who already has a "Renaissance"
  -- of their own gets this one under a name that says where it came from.
  insert into public.folders (user_id, name, photo_path, shared, origin_id)
  values (
    me,
    case
      when exists (
        select 1 from public.folders f
        where f.user_id = me and lower(f.name) = lower(source.name)
      )
      then source.name || ' (' || (
        select pr.handle from public.profiles pr where pr.user_id = source.user_id
      ) || ')'
      else source.name
    end,
    source.photo_path,
    false,
    source.id
  ) returning id into made;

  for link in
    select ef.event_id, ef.importance
    from public.event_folders ef
    join public.events e on e.id = ef.event_id
    where ef.folder_id = source.id and e.shared
  loop
    theirs := public.copy_one_event(link.event_id, me);
    if theirs is not null then
      insert into public.event_folders (event_id, folder_id, importance)
      values (theirs, made, link.importance)
      on conflict do nothing;
    end if;
  end loop;

  insert into public.copies (kind, source_id, user_id)
  values ('folder', source.id, me) on conflict do nothing;

  return made;
end;
$function$;

revoke execute on function public.copy_one_event(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.search_folders(
  text, numeric, numeric, double precision, double precision, double precision,
  text, integer, double precision, uuid) from public, anon;
revoke execute on function public.shared_folder(uuid) from public, anon;
revoke execute on function public.copy_folder(uuid) from public, anon;;
