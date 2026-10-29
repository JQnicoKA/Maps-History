/**
 * Events that look like the one being written — asked once its year is known.
 *
 * **The year is what makes this usable at all**, and the measurement was
 * unambiguous. On a collection of 39 events, the title alone raised 46
 * warnings across 18 of them and not one was right: "Mort de Clotaire" (561)
 * scores a perfect 1.00 against "Mort de Clotaire II" (629), "Fin de la faide
 * royale" scores 0.86 against "Début de la faide royale" — the opposite
 * event — and "Mort de Théodebert" against "Mort de Theodebald", two
 * different men. History is made of numbered homonyms and of "death of X",
 * "beginning of Y": a title is a remarkably poor identifier here. With the
 * year, the same 39 events raised three warnings, all three genuine.
 *
 * So the similarity opens the suspicion and the year settles it. Word
 * similarity rather than plain similarity, because a short title measured
 * against a long one scores low on the latter — "Vouillé" against "Bataille
 * de Vouillé" is 0.47 one way and 1.00 the other — and because it is what
 * catches a misspelling, which is precisely how an accidental duplicate is
 * born: nobody who types "Bataile de Vouille" will ever find the real one by
 * searching for it.
 *
 * One's own events are included, marked `mine`. Finding that you have
 * written the same thing twice is worth as much as finding that somebody else
 * has — more, even, since it is yours to merge.
 *
 * The shape is the catalogue's own, so the card that lists these is the card
 * that lists a search. `rank` carries the similarity.
 */
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
    and extensions.word_similarity(public.plain(said), public.plain(e.title)) >= 0.6
    -- Two years for a date somebody is sure of; twenty-five when either side
    -- wears the tilde, because "vers 1450" and 1453 are very likely the same
    -- fact told by two readers who each rounded differently.
    and abs(e.start_year - at_year) <= case
      when fuzzy or e.start_approx then 25 else 2
    end
  -- Stars first: a two-per-cent difference in similarity is worth nothing
  -- next to "thirty readers thought this one was the good one".
  order by e.stars desc,
           extensions.word_similarity(public.plain(said), public.plain(e.title)) desc,
           e.id desc
  limit 5;
$function$;

revoke execute on function public.events_like(text, integer, boolean)
  from public, anon;;
