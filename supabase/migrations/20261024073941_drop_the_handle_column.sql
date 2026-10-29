-- Le pseudonyme quitte la base.
--
-- Plus aucune fonction ne le lit — vérifié avant d'en arriver là —, et
-- l'application ne l'affichait ni ne le laissait changer : `rename()` existait
-- dans le fournisseur d'authentification sans qu'aucun écran ne l'appelle.
-- Il était tiré au sort à l'inscription, envoyé à chaque recherche de la
-- bibliothèque, et jeté à l'arrivée.
--
-- Partent avec lui sa contrainte de forme et son index d'unicité, qui n'ont
-- plus rien à garder. `library` conserve le sien.
--
-- Les cinq profils existants perdent un nom que personne n'a jamais vu.
begin;

drop index if exists public.profiles_handle_unique;

alter table public.profiles
  drop constraint if exists profiles_handle_shape;

alter table public.profiles
  drop column if exists handle;

commit;

select
  (select count(*) from public.profiles) as profils_intacts,
  (select count(*) from information_schema.columns
   where table_schema='public' and table_name='profiles' and column_name='handle') as colonne_restante;;
