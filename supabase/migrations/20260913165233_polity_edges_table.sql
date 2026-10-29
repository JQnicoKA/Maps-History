-- Le graphe de voisinage des polités, par **nom** et non par version : c'est ce
-- qui permet à un empire de garder sa couleur pendant que ses frontières
-- bougent. Une arête relie deux noms dès lors qu'une version de l'un a touché
-- une version de l'autre alors que les deux existaient en même temps.
create table if not exists public.polity_edges (
  a text not null,
  b text not null,
  primary key (a, b)
);

alter table public.polity_edges enable row level security;
create policy "prototype open access" on public.polity_edges
  for all to anon, authenticated using (true) with check (true);;
