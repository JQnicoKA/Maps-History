-- Les portes cessent de lire « ce que chacun a partagé ».
--
-- Quatorze fonctions, une seule substitution : toute lecture qualifiée
-- `x.shared` devient `x.published`. Appliquée par le texte de la fonction
-- elle-même plutôt qu'en réécrivant quatre mille caractères à la main — et
-- avec deux garde-fous, parce qu'une substitution aveugle ferait des dégâts
-- invisibles :
--
-- - `\M` exige une fin de mot, sinon `public.shared_event` deviendrait
--   `public.published_event` et la fonction serait renommée ;
-- - le `\w+\.` exige un alias, sinon les listes de colonnes d'`insert`
--   (`…, name, shared, origin_id)`) seraient touchées alors que la colonne
--   `shared` existe toujours et garde son rôle : l'autorisation que l'auteur
--   donne au conservateur.
--
-- Et la jointure sur `profiles` gagne `and pr.library` : seul le compte
-- bibliothèque peut sortir par ces portes. `published` n'est posé que sur ses
-- lignes, donc c'est une ceinture par-dessus une bretelle — mais c'est la
-- bretelle qu'on ne veut pas voir lâcher.
do $$
declare
  cible text;
  avant text;
  apres text;
begin
  foreach cible in array array[
    'search_events', 'search_characters', 'search_folders', 'search_trees',
    'shared_event', 'shared_character', 'shared_folder', 'shared_tree',
    'events_like', 'characters_like',
    'copy_event', 'copy_character', 'copy_folder', 'copy_tree'
  ]
  loop
    select pg_get_functiondef(p.oid) into avant
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = cible;

    if avant is null then
      raise exception 'Fonction introuvable : %', cible;
    end if;

    apres := regexp_replace(avant, '(\w+)\.shared\M', '\1.published', 'g');
    apres := regexp_replace(
      apres,
      '(join public\.profiles pr on pr\.user_id = \w+\.user_id)',
      '\1 and pr.library',
      'g'
    );

    if apres = avant then
      raise exception 'Rien à substituer dans % : la forme attendue a changé', cible;
    end if;

    execute apres;
  end loop;
end $$;;
