-- Les quatre fonctions qui copient datent désormais la prise.
--
-- Deux substitutions, sur le texte des fonctions plutôt qu'à la main : la
-- colonne s'ajoute en queue de liste, `now()` en queue de valeurs. Chacune
-- est vérifiée, et la boucle refuse de continuer si la forme attendue a
-- changé — une substitution qui ne trouve rien et se tait, c'est la panne
-- qu'on découvre trois semaines plus tard.
do $$
declare
  cible text;
  avant text;
  apres text;
begin
  foreach cible in array array[
    'copy_one_event', 'copy_one_character', 'copy_folder', 'copy_tree'
  ]
  loop
    select pg_get_functiondef(p.oid) into avant
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = cible;

    if avant is null then
      raise exception 'Fonction introuvable : %', cible;
    end if;

    apres := regexp_replace(
      avant, 'shared, origin_id(\s*\))', 'shared, origin_id, taken_at\1'
    );
    if apres = avant then
      raise exception 'Liste de colonnes introuvable dans %', cible;
    end if;

    avant := apres;
    apres := replace(
      avant, E'source.id\n  ) returning', E'source.id, now()\n  ) returning'
    );
    if apres = avant then
      raise exception 'Liste de valeurs introuvable dans %', cible;
    end if;

    execute apres;
  end loop;
end $$;;
