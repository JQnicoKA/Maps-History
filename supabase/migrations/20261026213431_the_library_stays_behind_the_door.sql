-- `anon` n'a rien à faire ici, et la bibliothèque ne le lui a jamais donné.
--
-- Les droits par défaut du schéma accordent `execute` à `anon` sur toute
-- fonction qui naît, et `revoke all from public` ne l'atteint pas : `public`
-- est le pseudo-rôle, `anon` en est un vrai. Réécrire les deux portes de
-- recherche les a donc fait naître une seconde fois, avec un droit que leurs
-- sœurs n'ont pas — `search_trees`, `shared_event` et `copy_event` s'en
-- tiennent à `authenticated` et `service_role`.
--
-- La bibliothèque se lit connecté : c'est de là que viennent `auth.uid()`,
-- les blocages, « déjà copié » et « c'est le mien ».
revoke execute on function public.library_folders(text) from anon;
revoke execute on function public.search_events(text, numeric, numeric, double precision, double precision, double precision, text, integer, double precision, uuid, text[]) from anon;
revoke execute on function public.search_characters(text, numeric, numeric, double precision, double precision, double precision, text, integer, double precision, uuid, text[]) from anon;;
