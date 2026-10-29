-- Les territoires qu'une étude peut interroger, sans leur géométrie.
--
-- Une liste de candidats, et rien d'autre : la forme d'un territoire pèse
-- plusieurs dizaines de kilo-octets, et une étude n'en a besoin que d'une à la
-- fois — celle de la question posée, que `polities_by_ids` sait déjà rendre.
-- Mille cinq cents noms et leurs années tiennent en moins de cent kilo-octets.
--
-- **Un nom, une ligne.** La même entité paraît dans la table en autant de
-- tranches que son tracé a changé : la Francie occidentale y est onze fois. Onze
-- questions sur le même nom ne sont pas onze questions, et deux propositions
-- portant ce nom-là feraient une question sans réponse juste. On garde donc la
-- tranche qui couvre le plus longuement la fenêtre demandée ; à durée égale, la
-- plus vaste, qui est celle que le lecteur a vue sur sa carte.
--
-- Les territoires que le lecteur a rangés — `hidden_polities` — n'entrent pas :
-- ce qu'on a retiré de sa carte n'a pas à revenir sous forme de question.
create or replace function public.territories_to_study(
  from_year integer,
  to_year integer
)
returns table (
  id uuid,
  name text,
  start_year integer,
  end_year integer
)
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
  where p.start_year <= to_year
    and p.end_year >= from_year
    and not exists (
      select 1
      from public.hidden_polities h
      where h.user_id = auth.uid()
        and h.name = p.name
    )
  order by
    p.name,
    -- Le recouvrement de la fenêtre, le plus long d'abord.
    least(p.end_year, to_year) - greatest(p.start_year, from_year) desc,
    p.area_km2 desc nulls last,
    -- Pour que deux tranches jumelles sortent toujours dans le même ordre.
    p.id;
$$;

grant execute on function public.territories_to_study(integer, integer) to anon, authenticated;;
