-- Étape 3 du pipeline des territoires : recoller et simplifier.
-- Voir docs/territoires.md pour la marche complète.
--
-- Les vector tiles découpent la géométrie à leurs bords : un pays à cheval sur
-- deux tuiles arrive en morceaux, qui partagent leur ohm_id. ST_Union les
-- réunit, ST_SimplifyPreserveTopology les allège.
--
-- ATTENTION : sur un balayage mondial (~30 000 fragments) cette requête dépasse
-- le délai d'attente de la plupart des clients SQL, mais elle ABOUTIT côté
-- serveur. Ne la relancez pas : vérifiez d'abord avec la requête de contrôle
-- en fin de fichier.

begin;

delete from public.territories;

with parsed as (
  -- Chaque géométrie n'est analysée qu'une fois : la faire deux fois (dans le
  -- select et dans un having) doublait le temps de la requête.
  select
    f.ohm_id,
    f.name,
    f.start_year,
    f.end_year,
    public.st_makevalid(
      public.st_setsrid(public.st_geomfromgeojson(f.geojson::text), 4326)
    ) as geom
  from public.territory_fragments f
  where f.ohm_id is not null
),
merged as (
  select
    ohm_id,
    name,
    min(start_year) as start_year,
    max(end_year) as end_year,
    public.st_union(geom) as geom
  from parsed
  group by ohm_id, name
)
insert into public.territories (ohm_id, name, start_year, end_year, geom)
select
  ohm_id,
  coalesce(name, 'Sans nom'),
  start_year,
  end_year,
  -- 0,01° ≈ 1,1 km. Monter à 0,02 divise par deux le poids d'une date moderne,
  -- au prix de côtes anguleuses au zoom régional.
  public.st_multi(
    public.st_collectionextract(
      public.st_makevalid(public.st_simplifypreservetopology(geom, 0.01)),
      3
    )
  )
from merged
where not public.st_isempty(geom);

commit;

-- Contrôle.
select
  count(*) as entites,
  sum(public.st_npoints(geom)) as sommets,
  pg_size_pretty(pg_total_relation_size('public.territories')) as taille
from public.territories;
