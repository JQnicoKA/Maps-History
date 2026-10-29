-- Renommer un territoire, des deux côtés à la fois.
--
-- Le nom est la clé primaire de `polity_wash` : renommer dans `polities` sans
-- renommer là aussi ferait perdre son lavis au territoire, qui retomberait sur
-- la couleur tirée de son nom. Une fonction plutôt que deux `update` recopiés
-- à chaque fois, parce que c'est précisément le genre d'oubli qu'on ne voit
-- pas avant d'avoir rechargé la carte.
--
-- **Une fusion n'est pas un renommage.** Quand le nom d'arrivée existe déjà,
-- son lavis existe aussi, et renommer dessus buterait sur la clé primaire : le
-- lavis du nom qui disparaît est alors supprimé, et les tranches rejoignent la
-- couleur de leur nouveau nom.
create or replace function public.rename_polity(ancien text, nouveau text)
returns integer
language plpgsql
set search_path to ''
as $$
declare touche integer;
begin
  if exists (select 1 from public.polity_wash where name = nouveau) then
    delete from public.polity_wash where name = ancien;
  else
    update public.polity_wash set name = nouveau where name = ancien;
  end if;

  update public.polities set name = nouveau where name = ancien;
  get diagnostics touche = row_count;

  update public.hidden_polities set name = nouveau where name = ancien;
  return touche;
end;
$$;

-- Le journal des corrections, qui n'existait pas : le dictionnaire
-- `polity_french` dit comment on est passé de l'anglais au français, il ne dit
-- pas ce qu'on a corrigé ensuite. Sans lui, personne ne pourrait savoir dans
-- six mois pourquoi « Comté de Brabant » a disparu.
create table if not exists public.polity_corrections (
  id bigint generated always as identity primary key,
  avant text not null,
  apres text not null,
  pourquoi text not null,
  tranches integer not null,
  fait_le timestamptz not null default now()
);

alter table public.polity_corrections enable row level security;;
