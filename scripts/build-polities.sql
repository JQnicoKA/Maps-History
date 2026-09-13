-- Étape 2 (et dernière) du pipeline Cliopatria : simplifier et indexer.
-- Voir docs/territoires.md pour la marche complète.
--
-- Rien à recoller ici, contrairement à OHM : Cliopatria livre la géométrie
-- entière. Il ne reste qu'à alléger le tracé et à calculer une fois pour
-- toutes ce que la carte lit à chaque image — l'aire et l'ancre du nom.
--
-- ATTENTION : sur les 12 043 polités cette requête dépasse le délai d'attente
-- de la plupart des clients SQL, mais elle ABOUTIT côté serveur. Ne la
-- relancez pas : vérifiez d'abord avec la requête de contrôle en fin de
-- fichier. Au besoin, découpez-la en tranches avec un `where f.id between …`.

begin;

delete from public.polities;

insert into public.polities (
  name, start_year, end_year, area, area_km2,
  wikidata, wikipedia, seshat_id, geom, anchor
)
with simplifie as (
  select
    f.name,
    f.start_year,
    f.end_year,
    f.area_km2,
    f.wikidata,
    f.wikipedia,
    f.seshat_id,
    -- 0,01° ≈ 1,1 km, la même tolérance que pour les territoires OHM. Les
    -- tracés de Cliopatria sont déjà généralisés à une échelle savante, donc
    -- le gain est plus modeste — mais il reste bon à prendre.
    public.st_multi(
      public.st_collectionextract(
        public.st_makevalid(
          public.st_simplifypreservetopology(
            public.st_setsrid(public.st_geomfromgeojson(f.geojson::text), 4326),
            0.01
          )
        ),
        3
      )
    ) as geom
  from public.polity_fragments f
)
select
  name,
  start_year,
  end_year,
  round(public.st_area(geom)::numeric, 3),
  area_km2,
  wikidata,
  wikipedia,
  seshat_id,
  geom,
  -- ST_PointOnSurface et non ST_Centroid : le centroïde d'un territoire en
  -- croissant tombe hors de ses terres. Sur la plus grande partie, pour que le
  -- nom se pose sur le continent et non sur une île perdue.
  (
    select public.st_pointonsurface(d.geom)
    from public.st_dump(geom) d
    order by public.st_area(d.geom) desc
    limit 1
  )
from simplifie
where not public.st_isempty(geom);

commit;

-- Contrôle.
select
  count(*) as polites,
  count(distinct name) as noms,
  sum(public.st_npoints(geom)) as sommets,
  pg_size_pretty(pg_total_relation_size('public.polities')) as taille
from public.polities;
