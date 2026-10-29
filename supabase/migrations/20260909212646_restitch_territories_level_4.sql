with parsed as (
  select
    f.ohm_id, f.name, f.admin_level, f.start_year, f.end_year,
    public.st_makevalid(
      public.st_setsrid(public.st_geomfromgeojson(f.geojson::text), 4326)
    ) as geom
  from public.territory_fragments f
  where f.ohm_id is not null and f.admin_level = 4
),
merged as (
  select ohm_id, name, admin_level,
    min(start_year) as start_year, max(end_year) as end_year,
    public.st_union(geom) as geom
  from parsed
  group by ohm_id, name, admin_level
)
insert into public.territories (ohm_id, name, admin_level, start_year, end_year, geom)
select ohm_id, coalesce(name, 'Sans nom'), coalesce(admin_level, 2), start_year, end_year,
  public.st_multi(
    public.st_collectionextract(
      public.st_makevalid(public.st_simplifypreservetopology(geom, 0.01)), 3
    )
  )
from merged
where not public.st_isempty(geom);;
