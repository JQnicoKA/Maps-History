insert into public.polity_edges (a, b)
select distinct a.name, b.name
from public.polities a
join public.polities b
  on a.name < b.name
  -- Contemporaines : les bornes sont inclusives des deux côtés.
  and a.start_year <= b.end_year
  and b.start_year <= a.end_year
  and public.st_intersects(a.geom, b.geom)
on conflict do nothing;;
