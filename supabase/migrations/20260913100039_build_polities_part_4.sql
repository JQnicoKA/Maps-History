insert into public.polities (
  name, start_year, end_year, area, area_km2,
  wikidata, wikipedia, seshat_id, geom, anchor
)
with simplifie as (
  select f.name, f.start_year, f.end_year, f.area_km2, f.wikidata, f.wikipedia, f.seshat_id,
    public.st_multi(
      public.st_collectionextract(
        public.st_makevalid(
          public.st_simplifypreservetopology(
            public.st_setsrid(public.st_geomfromgeojson(f.geojson::text), 4326), 0.01
          )
        ), 3
      )
    ) as geom
  from public.polity_fragments f
  where f.id % 4 = 3
)
select name, start_year, end_year,
  round(public.st_area(geom)::numeric, 3), area_km2, wikidata, wikipedia, seshat_id, geom,
  (select public.st_pointonsurface(d.geom) from public.st_dump(geom) d
   order by public.st_area(d.geom) desc limit 1)
from simplifie
where not public.st_isempty(geom);;
