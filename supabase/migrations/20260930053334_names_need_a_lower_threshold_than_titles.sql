-- 0.6 for names where events use 0.8, and the difference is not a whim.
--
-- Event titles are built of boilerplate — "Bataille de", "Mort de", "Début
-- de" — so two unrelated events share a long prefix and score high: the worst
-- false positive measured was 0.73. Names have no boilerplate. Across every
-- pair of genuinely different people in this database the worst false
-- positive is 0.53 ("Childebert Ier" against "Childéric Ier", and Merovingian
-- names are about as close as names come).
--
-- Meanwhile names are short, so a single wrong letter costs far more of the
-- trigram overlap: "Clovs" against "Clovis" scores 0.67, where a misspelt
-- event title still scored 0.94. At 0.8 the typo — the very thing this is for
-- — went unnoticed.
--
--   noms      vrais   "Clovis" ↔ "Clovis"                1.00
--                     "Charle Martel" ↔ "Charles Martel" 0.81
--                     "Clovs" ↔ "Clovis"                 0.67   ← le pire vrai
--             faux    "Childebert Ier" ↔ "Childéric Ier" 0.53   ← le pire faux
--                     "Clovis" ↔ "Clotaire"              0.43
--
-- 0.6 sits in that gap. The margin is thinner than for events, and the birth
-- year is what makes it safe: two homonymous kings are decades apart.
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
    and extensions.word_similarity(public.plain(said), public.plain(c.name)) >= 0.6
    and abs(c.birth_year - at_year) <= case
      when fuzzy or c.birth_approx then 25 else 2
    end
  order by c.stars desc,
           extensions.word_similarity(public.plain(said), public.plain(c.name)) desc,
           c.id desc
  limit 5;
$function$;

revoke execute on function public.characters_like(text, integer, boolean)
  from public, anon;;
