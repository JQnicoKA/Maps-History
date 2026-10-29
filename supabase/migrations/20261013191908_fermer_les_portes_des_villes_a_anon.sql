-- Les portes d'un compte ne s'ouvrent qu'à un compte.
--
-- Chacune lit `auth.uid()` et ne rendrait rien à un visiteur anonyme — mais
-- la passe de sécurité a posé la règle pour les territoires et une fonction
-- ouverte à `public` est une fonction qu'on oublie. Même traitement ici.
revoke execute on function public.drawn_places_at(numeric) from public, anon;
revoke execute on function public.my_places() from public, anon;
revoke execute on function public.search_places(
  text, numeric, numeric, double precision, double precision, double precision,
  text, integer, double precision, uuid
) from public, anon;
revoke execute on function public.shared_place(uuid) from public, anon;
revoke execute on function public.copy_place(uuid) from public, anon;;
