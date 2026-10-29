-- `stale()` rendait la ligne du lecteur et rien d'autre, parce qu'on ne lui
-- demandait que « reprendre ou pas ». On peut désormais aller **voir** la
-- version de la bibliothèque avant de décider, donc il faut savoir laquelle :
-- `entry` est son identifiant.
drop function if exists public.stale();

create function public.stale()
 returns table(kind text, id uuid, title text, touched boolean, entry uuid)
 language sql
 stable security definer
 set search_path to ''
as $function$
  select 'event'::text, mine.id, mine.title,
         mine.updated_at > mine.taken_at, entry.id
  from public.events mine
  join public.events entry on entry.id = mine.origin_id and entry.published
  where mine.user_id = auth.uid()
    and mine.taken_at is not null
    and entry.updated_at > mine.taken_at
  union all
  select 'character', mine.id, mine.name,
         mine.updated_at > mine.taken_at, entry.id
  from public.characters mine
  join public.characters entry on entry.id = mine.origin_id and entry.published
  where mine.user_id = auth.uid()
    and mine.taken_at is not null
    and entry.updated_at > mine.taken_at;
$function$;

revoke execute on function public.stale() from public, anon;
grant execute on function public.stale() to authenticated;;
