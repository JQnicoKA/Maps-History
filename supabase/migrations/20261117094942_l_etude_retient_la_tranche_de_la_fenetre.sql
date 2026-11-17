-- Une étude de l'Europe en 2000-2001 ne posait que 13 questions sur 55 noms.
--
-- Pour chaque nom, la fonction gardait la tranche la plus vaste de toute son
-- histoire. L'Allemagne y était représentée par une tranche d'avant 1991, et
-- tombait donc hors de la fenêtre étudiée alors qu'elle existe en 2000.
--
-- La fenêtre est désormais transmise : pour chaque nom, on retient d'abord une
-- tranche qui la touche, puis la plus vaste. Sans fenêtre, ou pour un nom
-- absent de la fenêtre (gardé comme fausse réponse), rien ne change.
--
-- Les deux paramètres ont une valeur par défaut, si bien qu'un ancien build qui
-- n'envoie que `part` tombe sur cette même fonction. L'ancienne signature est
-- supprimée : en garder deux rendrait l'appel ambigu pour PostgREST.

drop function if exists public.territories_to_study(text);

create function public.territories_to_study(
  part text default null,
  from_year integer default null,
  to_year integer default null
)
returns table (id uuid, name text, start_year integer, end_year integer)
language sql
stable
set search_path to ''
as $$
  select distinct on (p.name)
    p.id,
    p.name,
    p.start_year,
    p.end_year
  from public.polities p
  where (
      part is null
      or part = case
        when public.st_x(p.anchor) <= -25 then 'americas'
        when public.st_x(p.anchor) <= 45 and public.st_y(p.anchor) >= 25
          then 'europe'
        when public.st_x(p.anchor) <= 43
          or (
            public.st_x(p.anchor) <= 51
            and public.st_y(p.anchor) between -27 and -11
          )
          then 'africa'
        else 'asia'
      end
    )
    and not exists (
      select 1
      from public.hidden_polities h
      where h.user_id = auth.uid()
        and h.name = p.name
    )
  order by
    p.name,
    -- Une tranche qui touche la fenêtre étudiée passe avant toute autre.
    (
      from_year is not null
      and to_year is not null
      and p.start_year <= to_year
      and p.end_year >= from_year
    ) desc,
    p.area_km2 desc nulls last,
    -- Pour que deux tranches jumelles sortent toujours dans le même ordre.
    p.id;
$$;

grant execute on function public.territories_to_study(text, integer, integer)
  to anon, authenticated;
