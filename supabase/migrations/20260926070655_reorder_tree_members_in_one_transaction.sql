-- Réarranger une ligne, en une requête et d'un seul bloc.
--
-- L'application écrivait une position par aller-retour, en série : un dépôt
-- qui écarte quatre personnes coûtait cinq voyages jusqu'ici, soit plusieurs
-- secondes sur un réseau mobile. Pire, la suite n'était pas atomique — une
-- coupure au milieu laissait la ligne à moitié réarrangée, avec deux
-- personnages dans la même colonne, ce que le calcul côté client garantit
-- pourtant de ne jamais produire.
--
-- `security invoker` et rien d'autre : la fonction s'exécute avec les droits
-- de l'appelant, donc les policies de `tree_members` s'appliquent telles
-- quelles. Elle ne peut pas déplacer les membres d'un arbre qui n'est pas le
-- sien, et il n'y a aucune vérification à réécrire ici.
create or replace function public.reorder_tree_members(moves jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.tree_members m
  set position = (wanted.value ->> 'position')::int
  from jsonb_array_elements(moves) as wanted
  where m.id = (wanted.value ->> 'id')::uuid;
end;
$$;

revoke all on function public.reorder_tree_members(jsonb) from public, anon;
grant execute on function public.reorder_tree_members(jsonb) to authenticated;;
