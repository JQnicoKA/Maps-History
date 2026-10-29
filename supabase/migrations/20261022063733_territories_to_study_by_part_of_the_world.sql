-- Les territoires d'une partie du monde, sans leur géométrie.
--
-- Remplace la première version, qui prenait une fenêtre d'années. Deux raisons
-- de déplacer le tamis :
--
--   1. **Mille cinq cents noms ne sont pas une étude.** Une partie du monde en
--      est une : sept cent quatre pour l'Europe et son contour méditerranéen,
--      six cent dix-sept pour l'Asie et l'Océanie, cent douze pour les
--      Amériques, cent sept pour l'Afrique. Croisée avec les années, chacune
--      donne une séance d'une longueur qu'on peut mener à bout.
--
--   2. **Les fausses réponses ont besoin de plus large que la question.**
--      L'Afrique entre 800 et 1200 ne compte que quatre noms ; si les leurres
--      venaient de cette fenêtre, les quatre mêmes propositions reviendraient
--      à chaque question et la troisième se devinerait. La fonction rend donc
--      toute la partie du monde — quelques dizaines de kilo-octets — et c'est
--      l'application qui retient les années pour les questions, en gardant le
--      reste pour les leurres.
--
-- **Le découpage se lit sur l'ancre, et il est exclusif.** Quatre règles
-- essayées dans l'ordre, la première qui répond l'emporte, et la dernière
-- ramasse ce qui reste : aucun territoire ne peut manquer à l'appel ni paraître
-- deux fois. Le contour méditerranéen va avec l'Europe plutôt qu'avec
-- l'Afrique, puisque c'est ainsi qu'il a été demandé : le Maghreb, l'Égypte et
-- le Levant se révisent avec Rome et Byzance, et l'Afrique est alors celle qui
-- commence au sud du Sahara. Le canal du Mozambique est nommé à part, sans quoi
-- Madagascar se réviserait avec l'Indonésie.
--
-- `part` à `null` rend le monde entier, ce que l'étape « partie du monde »
-- n'offre pas mais qui reste le comportement juste pour qui ne demande rien.
--
-- **Un nom, une ligne** — voir la première version : la même entité paraît dans
-- la table en autant de tranches que son tracé a changé, et onze questions sur
-- la Francie occidentale ne sont pas onze questions. On garde la plus vaste,
-- qui est celle que le lecteur a vue sur sa carte.
create or replace function public.territories_to_study(part text default null)
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
    p.area_km2 desc nulls last,
    -- Pour que deux tranches jumelles sortent toujours dans le même ordre.
    p.id;
$$;

-- L'ancienne signature, que plus rien n'appelle.
drop function if exists public.territories_to_study(integer, integer);

grant execute on function public.territories_to_study(text) to anon, authenticated;;
