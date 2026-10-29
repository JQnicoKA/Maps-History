create or replace function public.to_review(want text default null::text, page_size integer default 50)
 returns table(kind text, id uuid, title text, who text, made timestamp with time zone, usable boolean)
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
begin
  if not exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.library
  ) then
    raise exception 'Cette file n''est ouverte qu''à la bibliothèque.';
  end if;

  return query
  with tout as (
    select 'event'::text as kind, e.id, e.title, e.user_id, e.created_at, e.shared
    from public.events e where not e.published and e.origin_id is null
    union all
    select 'character', c.id, c.name, c.user_id, c.created_at, c.shared
    from public.characters c where not c.published and c.origin_id is null
    union all
    -- Plus de classeurs : ils n'ont plus de ligne à relire. Le nom d'un
    -- classeur arrive avec l'événement qu'il range, et se juge avec lui.
    select 'tree', t.id, t.name, t.user_id, t.created_at, t.shared
    from public.trees t where not t.published and t.origin_id is null
    union all
    -- Les villes et les territoires n'ont plus d'`origin_id` : ils ne se
    -- copient pas, ils se promeuvent. Toute ligne est donc un original.
    select 'territory', d.id, d.name, d.user_id, d.created_at, d.shared
    from public.drawn_polities d
    union all
    select 'place', d.id, d.name, d.user_id, d.created_at, d.shared
    from public.drawn_places d
  )
  select
    q.kind, q.id, q.title, pr.handle, q.created_at, q.shared
  from tout q
  join public.profiles pr on pr.user_id = q.user_id
  where (want is null or q.kind = want)
    -- Jamais ses propres lignes : la bibliothèque n'a pas à se relire.
    and not pr.library
    and not exists (
      select 1 from public.review r
      where r.kind = q.kind and r.source_id = q.id
    )
  order by q.created_at desc
  limit least(greatest(coalesce(page_size, 50), 1), 500);
end;
$function$;;
