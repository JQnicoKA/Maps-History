create index trees_shared_name_idx on public.trees
  using gin (public.plain(name) extensions.gin_trgm_ops) where shared;
create index trees_shared_stars_idx on public.trees (stars desc, id desc)
  where shared;
create index trees_shared_recent_idx on public.trees (created_at desc, id desc)
  where shared;

/**
 * The catalogue of genealogies.
 *
 * A tree has no date and no place of its own; it takes both from the people
 * standing in it. So its span is the reach of their lives and its point
 * their centre — and `note` says how many people across how many
 * generations, which is the one thing that tells a lineage of three from a
 * dynasty of forty.
 *
 * A member whose character is gone counts for nothing. The drawing survives
 * such a hole, but the summary should not invent a person to fill it.
 */
create or replace function public.search_trees(
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
  stands as (
    select
      m.tree_id,
      count(*) as souls,
      count(distinct m.generation) as rows_of,
      min(c.birth_year) as first_year,
      max(coalesce(c.death_year, c.birth_year)) as last_year,
      min(c.from_key) as from_key,
      max(c.to_key) as to_key,
      public.ST_SetSRID(
        public.ST_MakePoint(avg(c.longitude), avg(c.latitude)), 4326
      )::public.geography as spot
    from public.tree_members m
    join public.characters c on c.id = m.character_id
    group by m.tree_id
  ),
  found as (
    select
      t.id,
      t.name as title,
      'tree'::text as kind,
      case coalesce(s.souls, 0)
        when 0 then 'vide'
        when 1 then '1 personnage'
        else s.souls || ' personnages · ' || s.rows_of || ' génération'
             || case when s.rows_of > 1 then 's' else '' end
      end as note,
      s.first_year::integer as start_year,
      null::smallint as start_month, null::smallint as start_day,
      false as start_approx,
      s.last_year::integer as end_year,
      null::smallint as end_month, null::smallint as end_day,
      false as end_approx,
      public.ST_X(s.spot::public.geometry) as longitude,
      public.ST_Y(s.spot::public.geometry) as latitude,
      -- The face of whoever stands highest and leftmost: a lineage is known
      -- by the one at its head.
      (
        select p.storage_path
        from public.tree_members m
        join public.character_photos p on p.character_id = m.character_id
        where m.tree_id = t.id
        order by m.generation, m.position, p.position
        limit 1
      ) as cover_path,
      pr.handle as author,
      t.stars,
      t.user_id = auth.uid() as mine,
      exists (
        select 1 from public.copies c
        where c.kind = 'tree' and c.source_id = t.id and c.user_id = auth.uid()
      ) as copied,
      exists (
        select 1 from public.reports r
        where r.kind = 'tree' and r.source_id = t.id
          and r.reporter = auth.uid()
      ) as reported,
      case sort
        when 'recent' then extract(epoch from t.created_at)
        else t.stars::double precision
      end as rank
    from public.trees t
    join public.profiles pr on pr.user_id = t.user_id
    left join stands s on s.tree_id = t.id
    where t.shared
      and not exists (
        select 1 from public.withheld w
        where w.kind = 'tree' and w.source_id = t.id
      )
      and not exists (
        select 1 from public.blocks b
        where (b.user_id = auth.uid() and b.blocked = t.user_id)
           or (b.user_id = t.user_id and b.blocked = auth.uid())
      )
      and (
        words is null or btrim(words) = ''
        or coalesce((
          select bool_and(public.plain(t.name) like '%' || word || '%')
          from unnest(string_to_array(public.plain(btrim(words)), ' ')) as word
          where word <> ''
        ), true)
      )
      and (until is null or (s.from_key is not null and s.from_key <= until))
      and (since is null or (s.to_key is not null and s.to_key >= since))
      and (
        (select h.spot from here h) is null or within_m is null
        or (
          s.spot is not null
          and public.ST_DWithin(s.spot, (select h.spot from here h), within_m)
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
 * One shared tree, whole enough to be drawn.
 *
 * Members, lines and faces: everything the canvas needs and nothing it does
 * not. The people come as the drawing uses them — a name, two dates, one
 * portrait — rather than as characters, because the reader will never hold
 * these rows and a bio nobody reads is a payload nobody wanted.
 *
 * Capped at two hundred members, which is far past any genealogy anybody
 * has drawn with a thumb and short of anything that would choke a card.
 */
create or replace function public.shared_tree(wanted uuid)
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select jsonb_build_object(
    'id', t.id,
    'title', t.name,
    'type', 'tree',
    'note', (
      select case count(*)
        when 0 then 'vide'
        when 1 then '1 personnage'
        else count(*) || ' personnages · ' || count(distinct m.generation)
             || ' génération'
             || case when count(distinct m.generation) > 1 then 's' else '' end
      end
      from public.tree_members m
      join public.characters c on c.id = m.character_id
      where m.tree_id = t.id
    ),
    'description', t.note,
    'start_year', (
      select min(c.birth_year) from public.tree_members m
      join public.characters c on c.id = m.character_id where m.tree_id = t.id
    ),
    'start_month', null, 'start_day', null, 'start_approx', false,
    'end_year', (
      select max(coalesce(c.death_year, c.birth_year))
      from public.tree_members m
      join public.characters c on c.id = m.character_id where m.tree_id = t.id
    ),
    'end_month', null, 'end_day', null, 'end_approx', false,
    'longitude', null, 'latitude', null,
    'author', pr.handle,
    'stars', t.stars,
    'mine', t.user_id = auth.uid(),
    'copied', exists (
      select 1 from public.copies c
      where c.kind = 'tree' and c.source_id = t.id and c.user_id = auth.uid()
    ),
    'reported', exists (
      select 1 from public.reports r
      where r.kind = 'tree' and r.source_id = t.id and r.reporter = auth.uid()
    ),
    'photos', '[]'::jsonb,
    'cast', '[]'::jsonb,
    'folders', '[]'::jsonb,
    'held', '[]'::jsonb,
    'members', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', m.id,
                 'character_id', m.character_id,
                 'generation', m.generation,
                 'position', m.position,
                 'importance', m.importance
               )
               order by m.generation, m.position
             )
      from (
        select * from public.tree_members mm
        where mm.tree_id = t.id
        order by mm.generation, mm.position
        limit 200
      ) m
    ), '[]'::jsonb),
    'links', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'from', l.parent_id, 'to', l.child_id, 'kind', l.kind
               )
             )
      from public.tree_links l where l.tree_id = t.id
    ), '[]'::jsonb),
    'people', coalesce((
      select jsonb_agg(distinct jsonb_build_object(
               'id', c.id,
               'name', c.name,
               'birth_year', c.birth_year, 'birth_month', c.birth_month,
               'birth_day', c.birth_day, 'birth_approx', c.birth_approx,
               'death_year', c.death_year, 'death_month', c.death_month,
               'death_day', c.death_day, 'death_approx', c.death_approx,
               'photo', (
                 select p.storage_path from public.character_photos p
                 where p.character_id = c.id order by p.position limit 1
               )
             ))
      from public.tree_members m
      join public.characters c on c.id = m.character_id
      where m.tree_id = t.id
    ), '[]'::jsonb)
  )
  from public.trees t
  join public.profiles pr on pr.user_id = t.user_id
  where t.id = wanted
    and t.shared
    and not exists (
      select 1 from public.withheld w
      where w.kind = 'tree' and w.source_id = t.id
    )
    and not exists (
      select 1 from public.blocks b
      where (b.user_id = auth.uid() and b.blocked = t.user_id)
         or (b.user_id = t.user_id and b.blocked = auth.uid())
    );
$function$;

/**
 * Takes a whole genealogy.
 *
 * The deepest copy of the five, and the only one where the *shape* has to
 * survive: every member keeps its generation, its rank in the row and its
 * weight, and every line has to be re-aimed at the members this reader now
 * owns. A map from the author's member to the reader's is what makes that
 * possible — without it the lines would point at rows in another account.
 *
 * The people come through `copy_one_character`, so a reader who already has
 * Clovis keeps the one they have rather than gaining a second.
 */
create or replace function public.copy_tree(wanted uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  me uuid := auth.uid();
  source public.trees%rowtype;
  made uuid;
  how_many integer;
  member record;
  link record;
  theirs uuid;
  mine_now uuid;
  same jsonb := '{}'::jsonb;
begin
  if me is null then
    raise exception 'Il faut être connecté.';
  end if;

  select * into source
  from public.trees t
  where t.id = wanted
    and t.shared
    and not exists (
      select 1 from public.withheld w
      where w.kind = 'tree' and w.source_id = t.id
    )
    and not exists (
      select 1 from public.blocks b
      where (b.user_id = me and b.blocked = t.user_id)
         or (b.user_id = t.user_id and b.blocked = me)
    );
  if not found then
    raise exception 'Cet arbre n''est plus partagé.';
  end if;
  if source.user_id = me then
    raise exception 'Cet arbre est déjà le vôtre.';
  end if;

  select t.id into made
  from public.trees t where t.user_id = me and t.origin_id = source.id
  limit 1;
  if made is not null then
    return made;
  end if;

  select count(*) into how_many
  from public.tree_members m where m.tree_id = source.id;
  if how_many > 200 then
    raise exception
      'Cet arbre compte % personnages, trop pour une seule copie.', how_many;
  end if;

  insert into public.trees (user_id, name, note, shared, origin_id)
  values (
    me,
    case
      when exists (
        select 1 from public.trees t
        where t.user_id = me and lower(t.name) = lower(source.name)
      )
      then source.name || ' (' || (
        select pr.handle from public.profiles pr where pr.user_id = source.user_id
      ) || ')'
      else source.name
    end,
    source.note, false, source.id
  ) returning id into made;

  for member in
    select * from public.tree_members m where m.tree_id = source.id
  loop
    theirs := public.copy_one_character(member.character_id, me);
    if theirs is null then
      continue;
    end if;
    insert into public.tree_members (
      tree_id, character_id, generation, position, importance, note
    ) values (
      made, theirs, member.generation, member.position, member.importance,
      member.note
    ) returning id into mine_now;
    -- The author's member, and the reader's: the lines are drawn between
    -- members, not between people, so they have to be translated.
    same := same || jsonb_build_object(member.id::text, mine_now);
  end loop;

  for link in
    select * from public.tree_links l where l.tree_id = source.id
  loop
    if same ? link.parent_id::text and same ? link.child_id::text then
      insert into public.tree_links (tree_id, parent_id, child_id, kind)
      values (
        made,
        (same ->> link.parent_id::text)::uuid,
        (same ->> link.child_id::text)::uuid,
        link.kind
      ) on conflict do nothing;
    end if;
  end loop;

  insert into public.copies (kind, source_id, user_id)
  values ('tree', source.id, me) on conflict do nothing;

  return made;
end;
$function$;

revoke execute on function public.search_trees(
  text, numeric, numeric, double precision, double precision, double precision,
  text, integer, double precision, uuid) from public, anon;
revoke execute on function public.shared_tree(uuid) from public, anon;
revoke execute on function public.copy_tree(uuid) from public, anon;;
