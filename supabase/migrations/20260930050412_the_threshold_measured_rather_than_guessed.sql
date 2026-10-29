-- 0.8, and the number was measured rather than chosen.
--
-- At 0.6 the wide window let "Bataille de Vouillé" raise "Bataille de
-- Tolbiac": the two share a long prefix and nothing else. Scored against
-- real titles, the two populations separate cleanly —
--
--   true      "Bataille de Vouillé" ↔ itself              1.00
--             "Vouillé"             ↔ "Bataille de Vouillé" 1.00
--             "Mort de Clotaire"    ↔ "Mort de Clotaire II" 1.00
--             "Bataile de Vouille"  ↔ "Bataille de Vouillé" 0.94   ← worst
--   false     "Mort de Clovis"      ↔ "Mort de Clotaire"    0.73   ← best
--             "Bataille de Vouillé" ↔ "Bataille de Tolbiac" 0.71
--             "Bataille de Vouillé" ↔ "Bataille de la Berre" 0.71
--
-- — so 0.8 sits in the gap with room either side, and one number then serves
-- both windows. What it cannot catch is a duplicate written in other words
-- entirely: "Victoire de Clovis sur les Wisigoths" is the same fact as
-- "Bataille de Vouillé" and no string will ever say so.
create or replace function public.events_like(
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
    e.id,
    e.title,
    e.type::text,
    e.start_year, e.start_month, e.start_day, e.start_approx,
    e.end_year, e.end_month, e.end_day, e.end_approx,
    e.longitude, e.latitude,
    (
      select p.storage_path from public.event_photos p
      where p.event_id = e.id order by p.position limit 1
    ),
    pr.handle,
    e.stars,
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

revoke execute on function public.events_like(text, integer, boolean)
  from public, anon;;
