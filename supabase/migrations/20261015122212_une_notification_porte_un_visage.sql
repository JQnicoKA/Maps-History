drop function if exists public.my_notices();

create function public.my_notices()
 returns table(
   sort text, kind text, source_id uuid, entry_id uuid, title text,
   touched boolean, attachable boolean, at timestamp with time zone,
   photo text
 )
 language sql
 stable security definer
 set search_path to ''
as $function$
  select 'admitted'::text, 'event'::text, r.source_id, r.became, entry.title,
         false, mine.id is not null, r.at,
         (select p.storage_path from public.event_photos p
           where p.event_id = entry.id order by p.position limit 1)
    from public.review r
    join public.events entry on entry.id = r.became and entry.published
    left join public.events mine
      on mine.id = r.source_id and mine.user_id = auth.uid()
   where r.kind = 'event' and r.state = 'admitted' and r.who = auth.uid()
     and (mine.id is null or mine.origin_id is distinct from r.became)
     and not exists (
       select 1 from public.dismissed d
        where d.user_id = auth.uid() and d.sort = 'admitted'
          and d.kind = 'event' and d.source_id = r.source_id
     )
  union all
  select 'admitted', 'character', r.source_id, r.became, entry.name,
         false, mine.id is not null, r.at,
         (select p.storage_path from public.character_photos p
           where p.character_id = entry.id order by p.position limit 1)
    from public.review r
    join public.characters entry on entry.id = r.became and entry.published
    left join public.characters mine
      on mine.id = r.source_id and mine.user_id = auth.uid()
   where r.kind = 'character' and r.state = 'admitted' and r.who = auth.uid()
     and (mine.id is null or mine.origin_id is distinct from r.became)
     and not exists (
       select 1 from public.dismissed d
        where d.user_id = auth.uid() and d.sort = 'admitted'
          and d.kind = 'character' and d.source_id = r.source_id
     )
  union all
  select 'promoted', 'place', r.source_id, r.became, p.name, false, false,
         r.at, null
    from public.review r
    join public.places p on p.id = r.became
   where r.kind = 'place' and r.state = 'admitted' and r.who = auth.uid()
     and not exists (
       select 1 from public.dismissed d
        where d.user_id = auth.uid() and d.sort = 'promoted'
          and d.kind = 'place' and d.source_id = r.source_id
     )
  union all
  select 'promoted', 'territory', r.source_id, r.became, po.name, false, false,
         r.at, null
    from public.review r
    join public.polities po on po.id = r.became
   where r.kind = 'territory' and r.state = 'admitted' and r.who = auth.uid()
     and not exists (
       select 1 from public.dismissed d
        where d.user_id = auth.uid() and d.sort = 'promoted'
          and d.kind = 'territory' and d.source_id = r.source_id
     )
  union all
  select 'stale', 'event', mine.id, entry.id, mine.title,
         mine.updated_at > mine.taken_at, false, entry.updated_at,
         (select p.storage_path from public.event_photos p
           where p.event_id = entry.id order by p.position limit 1)
    from public.events mine
    join public.events entry
      on entry.id = mine.origin_id and entry.published
   where mine.user_id = auth.uid()
     and mine.taken_at is not null
     and entry.updated_at > mine.taken_at
     and entry.updated_at > coalesce((
       select d.at from public.dismissed d
        where d.user_id = auth.uid() and d.sort = 'stale'
          and d.kind = 'event' and d.source_id = mine.id
     ), '-infinity'::timestamptz)
  union all
  select 'stale', 'character', mine.id, entry.id, mine.name,
         mine.updated_at > mine.taken_at, false, entry.updated_at,
         (select p.storage_path from public.character_photos p
           where p.character_id = entry.id order by p.position limit 1)
    from public.characters mine
    join public.characters entry
      on entry.id = mine.origin_id and entry.published
   where mine.user_id = auth.uid()
     and mine.taken_at is not null
     and entry.updated_at > mine.taken_at
     and entry.updated_at > coalesce((
       select d.at from public.dismissed d
        where d.user_id = auth.uid() and d.sort = 'stale'
          and d.kind = 'character' and d.source_id = mine.id
     ), '-infinity'::timestamptz)
  order by 8 desc;
$function$;

revoke execute on function public.my_notices() from public, anon;
grant execute on function public.my_notices() to authenticated;;
