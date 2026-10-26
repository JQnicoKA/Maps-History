-- Défaire « le filtre par classeur dans la bibliothèque »
-- =======================================================
--
-- À coller dans l'éditeur SQL de Supabase, avec la restauration du code.
--
-- **Aucune donnée n'a été touchée.** Les trois migrations n'ont fait que
-- lire : une fonction de plus, et un paramètre de plus sur deux portes de
-- recherche qui existaient déjà. Rien n'a été écrit dans `events`, dans
-- `characters`, ni ailleurs — les classeurs étaient déjà dans la colonne
-- `folders`, et la fiche de la bibliothèque les disait déjà sous « Rangé
-- dans », par `shared_event`.
--
-- Ce que les migrations ont fait :
--   1. `the_folders_of_the_library` — `library_folders(kind)`, qui relève les
--      noms de classeurs de ce qui est publié, avec leur poids et leur
--      dernière venue ;
--   2. `the_library_search_can_be_filed` — `filed text[]` ajouté à
--      `search_events` et `search_characters`. Les deux fonctions ont dû être
--      **déposées puis réécrites** : `create or replace` avec une liste
--      d'arguments différente fabrique une surcharge, et PostgREST ne saurait
--      plus laquelle appeler ;
--   3. `the_library_stays_behind_the_door` — `execute` retiré à `anon` sur les
--      trois. Les droits par défaut du schéma l'accordent à toute fonction qui
--      naît, et `revoke all from public` ne l'atteint pas : renaître avait
--      donné aux deux portes un droit que leurs sœurs n'ont pas.
--
-- Défaire, c'est donc remettre les deux portes dans leur état d'avant — sans
-- `filed` — et retirer la troisième. **Et ne pas oublier `anon` au retour** :
-- les fonctions ci-dessous naissent elles aussi, donc la ligne de `revoke`
-- est à la fin, et elle n'est pas décorative.
--
-- Le corps des deux portes est à reprendre de la migration
-- `the_library_search_can_be_filed`, en ôtant les trois lignes du filtre :
--
--       and (
--         filed is null or coalesce(array_length(filed, 1), 0) = 0
--         or e.folders && filed
--       )
--
-- plutôt que recopié ici, où il aurait vieilli séparément. Le plus sûr est de
-- prendre la définition de cette migration telle quelle, d'en retirer le
-- paramètre `filed text[] default null` et ces trois lignes, et de la jouer.

begin;

-- 1. La liste des classeurs de la bibliothèque n'est plus demandée par
--    personne : le panneau restauré ne connaît pas `api.folders`.
drop function if exists public.library_folders(text);

-- 2. Les deux portes dans leur version filtrable. À remplacer par les deux
--    `create function` sans `filed`, comme dit plus haut — les déposer seules
--    laisserait la bibliothèque muette.
drop function if exists public.search_events(text, numeric, numeric, double precision, double precision, double precision, text, integer, double precision, uuid, text[]);
drop function if exists public.search_characters(text, numeric, numeric, double precision, double precision, double precision, text, integer, double precision, uuid, text[]);

-- ... ici les deux `create function` sans `filed`, puis :
--
--   revoke execute on function public.search_events(text, numeric, numeric, double precision, double precision, double precision, text, integer, double precision, uuid) from anon;
--   revoke execute on function public.search_characters(text, numeric, numeric, double precision, double precision, double precision, text, integer, double precision, uuid) from anon;
--
-- Les droits attendus, les mêmes que `search_trees` :
--   {postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}

commit;

-- À vérifier après coup : une seule définition par nom, et pas d'`anon`.
--
--   select p.proname, count(*) as surcharges, string_agg(p.proacl::text, ' | ')
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public'
--     and p.proname in ('search_events', 'search_characters', 'search_trees')
--   group by p.proname;
