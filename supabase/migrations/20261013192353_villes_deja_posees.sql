-- Les villes de la communauté qui ressemblent à celle qu'on est en train de
-- poser. Dit avant plutôt qu'après : quelqu'un a peut-être déjà posé cette
-- Carthage-là, et le moment de l'apprendre est avant qu'une seconde
-- n'apparaisse dans la communauté.
--
-- Calque de `territories_like`, à une différence près : une ville sans
-- année de fin est encore là, donc elle rencontre toutes les époques
-- postérieures à sa fondation.
create or replace function public.places_like(
  said text, at_year integer, fuzzy boolean default false
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
  select
    d.id, d.name, 'place'::text, null::text,
    d.start_year, null::smallint, null::smallint, false,
    d.end_year, null::smallint, null::smallint, false,
    d.longitude, d.latitude,
    null::text,
    pr.handle, d.stars,
    d.user_id = auth.uid(),
    exists (
      select 1 from public.copies c
      where c.kind = 'place' and c.source_id = d.id
        and c.user_id = auth.uid()
    ),
    exists (
      select 1 from public.reports r
      where r.kind = 'place' and r.source_id = d.id
        and r.reporter = auth.uid()
    ),
    extensions.word_similarity(public.plain(said), public.plain(d.name))::double precision
  from public.drawn_places d
  join public.profiles pr on pr.user_id = d.user_id
  where d.shared
    and btrim(coalesce(said, '')) <> ''
    and at_year is not null
    and not exists (
      select 1 from public.withheld w
      where w.kind = 'place' and w.source_id = d.id
    )
    and not exists (
      select 1 from public.blocks b
      where (b.user_id = auth.uid() and b.blocked = d.user_id)
         or (b.user_id = d.user_id and b.blocked = auth.uid())
    )
    and extensions.word_similarity(public.plain(said), public.plain(d.name)) >= 0.6
    and d.start_year <= at_year + case when fuzzy then 200 else 50 end
    and coalesce(d.end_year, 1000000) >= at_year - case when fuzzy then 200 else 50 end
  order by d.stars desc,
           extensions.word_similarity(public.plain(said), public.plain(d.name)) desc,
           d.id desc
  limit 5;
$$;

revoke execute on function public.places_like(text, integer, boolean) from public, anon;;
