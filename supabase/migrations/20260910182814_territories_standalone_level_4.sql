with fief as (
  select t.id, t.geom,
    case
      when t.start_year is null and t.end_year is null then 2000
      when t.start_year is null then t.end_year - 1
      when t.end_year is null then t.start_year + 1
      else (t.start_year + t.end_year) / 2
    end as mid
  from public.territories t
  where t.admin_level = 4
)
update public.territories t
set standalone = not exists (
  select 1 from public.territories s
  where s.admin_level = 2
    and coalesce(s.start_year, -1000000) <= f.mid
    and coalesce(s.end_year, 1000000) > f.mid
    and public.st_contains(s.geom, public.st_pointonsurface(f.geom))
)
from fief f
where t.id = f.id;;
