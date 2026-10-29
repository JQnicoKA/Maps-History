-- Un sixième genre dans la communauté : la ville.
--
-- Les cinq portes se ressemblent assez pour que celle-ci soit un calque de
-- `search_territories`, moins la géométrie : une ville n'a ni contour, ni
-- étendue à annoncer, ni photographie. Ce qu'elle a — un nom, un point, des
-- années — le catalogue sait déjà le lire.

alter table public.copies drop constraint copies_kind_check;
alter table public.copies add constraint copies_kind_check
  check (kind = any (array['event', 'folder', 'character', 'tree', 'territory', 'place']));

alter table public.reports drop constraint reports_kind_check;
alter table public.reports add constraint reports_kind_check
  check (kind = any (array['event', 'folder', 'character', 'tree', 'territory', 'place']));

-- Le `case` du compteur d'étoiles n'a pas de branche `else` : un genre
-- inconnu y lève CASE_NOT_FOUND et fait échouer la copie entière. Celle-ci
-- lui manquait.
create or replace function public.count_the_star()
returns trigger
language plpgsql security definer
set search_path to ''
as $$
begin
  case new.kind
    when 'event' then
      update public.events set stars = stars + 1 where id = new.source_id;
    when 'folder' then
      update public.folders set stars = stars + 1 where id = new.source_id;
    when 'character' then
      update public.characters set stars = stars + 1 where id = new.source_id;
    when 'tree' then
      update public.trees set stars = stars + 1 where id = new.source_id;
    when 'territory' then
      update public.drawn_polities set stars = stars + 1 where id = new.source_id;
    when 'place' then
      update public.drawn_places set stars = stars + 1 where id = new.source_id;
  end case;
  return new;
end;
$$;

create or replace function public.search_places(
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
) returns table (
  id uuid, title text, kind text, note text,
  start_year integer, start_month smallint, start_day smallint, start_approx boolean,
  end_year integer, end_month smallint, end_day smallint, end_approx boolean,
  longitude double precision, latitude double precision,
  cover_path text, author text, stars integer,
  mine boolean, copied boolean, reported boolean, rank double precision
)
language sql stable security definer
set search_path to ''
as $$
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
      'place'::text as kind,
      null::text as note,
      d.start_year, null::smallint as start_month, null::smallint as start_day,
      false as start_approx,
      d.end_year, null::smallint as end_month, null::smallint as end_day,
      false as end_approx,
      d.longitude,
      d.latitude,
      null::text as cover_path,
      pr.handle as author,
      d.stars,
      d.user_id = auth.uid() as mine,
      exists (
        select 1 from public.copies c
        where c.kind = 'place' and c.source_id = d.id
          and c.user_id = auth.uid()
      ) as copied,
      exists (
        select 1 from public.reports r
        where r.kind = 'place' and r.source_id = d.id
          and r.reporter = auth.uid()
      ) as reported,
      case sort
        when 'recent' then extract(epoch from d.created_at)
        else d.stars::double precision
      end as rank
    from public.drawn_places d
    join public.profiles pr on pr.user_id = d.user_id
    where d.shared
      and not exists (
        select 1 from public.withheld w
        where w.kind = 'place' and w.source_id = d.id
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
      -- Sans fin, elle est encore là : elle touche donc toutes les époques
      -- postérieures à sa fondation.
      and (since is null or coalesce(d.end_year, 1000000) >= since)
      and (
        (select h.spot from here h) is null or within_m is null
        or public.ST_DWithin(
             public.ST_SetSRID(
               public.ST_MakePoint(d.longitude, d.latitude), 4326
             )::public.geography,
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
$$;

create or replace function public.shared_place(wanted uuid)
returns jsonb
language sql stable security definer
set search_path to ''
as $$
  select jsonb_build_object(
    'id', d.id,
    'title', d.name,
    'type', 'place',
    'note', null,
    'description', null,
    'start_year', d.start_year, 'start_month', null,
    'start_day', null, 'start_approx', false,
    'end_year', d.end_year, 'end_month', null,
    'end_day', null, 'end_approx', false,
    'longitude', d.longitude,
    'latitude', d.latitude,
    'author', pr.handle,
    'stars', d.stars,
    'mine', d.user_id = auth.uid(),
    'copied', exists (
      select 1 from public.copies c
      where c.kind = 'place' and c.source_id = d.id
        and c.user_id = auth.uid()
    ),
    'reported', exists (
      select 1 from public.reports r
      where r.kind = 'place' and r.source_id = d.id
        and r.reporter = auth.uid()
    ),
    'photos', '[]'::jsonb,
    'cast', '[]'::jsonb,
    'folders', '[]'::jsonb,
    'held', '[]'::jsonb,
    'shape', null
  )
  from public.drawn_places d
  join public.profiles pr on pr.user_id = d.user_id
  where d.id = wanted
    and d.shared
    and not exists (
      select 1 from public.withheld w
      where w.kind = 'place' and w.source_id = d.id
    )
    and not exists (
      select 1 from public.blocks b
      where (b.user_id = auth.uid() and b.blocked = d.user_id)
         or (b.user_id = d.user_id and b.blocked = auth.uid())
    );
$$;

create or replace function public.copy_place(wanted uuid)
returns uuid
language plpgsql security definer
set search_path to ''
as $$
declare
  me uuid := auth.uid();
  source public.drawn_places%rowtype;
  made uuid;
begin
  if me is null then
    raise exception 'Il faut être connecté.';
  end if;

  select * into source
  from public.drawn_places d
  where d.id = wanted
    and d.shared
    and not exists (
      select 1 from public.withheld w
      where w.kind = 'place' and w.source_id = d.id
    )
    and not exists (
      select 1 from public.blocks b
      where (b.user_id = me and b.blocked = d.user_id)
         or (b.user_id = d.user_id and b.blocked = me)
    );
  if not found then
    raise exception 'Cette ville n''est plus partagée.';
  end if;
  if source.user_id = me then
    raise exception 'Cette ville est déjà la vôtre.';
  end if;

  -- Deux fois la même ville serait deux pastilles au même endroit : on rend
  -- celle qu'on avait déjà prise.
  select d.id into made
  from public.drawn_places d
  where d.user_id = me and d.origin_id = source.id
  limit 1;
  if made is not null then
    return made;
  end if;

  insert into public.drawn_places (
    user_id, name, longitude, latitude, start_year, end_year,
    shared, origin_id
  ) values (
    me, source.name, source.longitude, source.latitude,
    source.start_year, source.end_year, false, source.id
  ) returning id into made;

  insert into public.copies (kind, source_id, user_id)
  values ('place', source.id, me) on conflict do nothing;

  return made;
end;
$$;;
