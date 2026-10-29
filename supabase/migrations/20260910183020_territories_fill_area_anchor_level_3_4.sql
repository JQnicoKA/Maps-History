update public.territories t
set area = round(public.st_area(t.geom)::numeric, 3),
    anchor = (
      select public.st_pointonsurface(d.geom)
      from public.st_dump(t.geom) d
      order by public.st_area(d.geom) desc
      limit 1
    )
where t.admin_level > 2 and t.anchor is null;;
