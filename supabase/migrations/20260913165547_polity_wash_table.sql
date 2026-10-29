-- Le résultat de la coloration de carte : un indice dans palette.washes, par
-- nom de polité. Calculé par scripts/colour-polities.mjs, à relancer si les
-- frontières changent.
create table if not exists public.polity_wash (
  name text primary key,
  wash smallint not null
);

alter table public.polity_wash enable row level security;
create policy "prototype open access" on public.polity_wash
  for all to anon, authenticated using (true) with check (true);;
