-- Ce qu'un lecteur ne veut plus voir sur sa carte.
--
-- « Supprimer » un territoire ne peut pas vouloir dire l'effacer : `polities`
-- est une donnée de référence, partagée par tous les comptes et rechargeable
-- depuis Cliopatria. C'est donc un masque personnel — la référence reste
-- intacte, et le lecteur peut revenir sur sa décision.
--
-- Masqué **par nom**, et pas par ligne : une entité existe en une douzaine de
-- versions au fil du temps, et personne ne souhaite faire disparaître le
-- Califat abbasside de 900 à 950 en le gardant de 950 à 1000. On masque une
-- entité, pas une tranche.
create table if not exists public.hidden_polities (
  user_id uuid not null references auth.users(id) on delete cascade
    default auth.uid(),
  name text not null,
  hidden_at timestamptz not null default now(),
  primary key (user_id, name)
);

alter table public.hidden_polities enable row level security;

create policy "own hidden polities" on public.hidden_polities
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());;
