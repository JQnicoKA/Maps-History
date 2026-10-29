-- Trois fonctions de déclencheur n'ont rien à faire dans l'API.
--
-- `give_a_handle`, `count_the_star` et `withhold_when_reported` renvoient
-- `trigger` : elles n'existent que pour être appelées par le mécanisme de
-- déclenchement, à l'insertion d'un compte, d'une copie ou d'un signalement.
-- Elles étaient pourtant exposées en `SECURITY DEFINER` sur
-- `/rest/v1/rpc/...`, et appelables sans même être connecté.
--
-- Inoffensif dans les faits — Postgres refuse d'exécuter une fonction `trigger`
-- hors d'un déclencheur, et un appel direct échoue sur « can only be called as
-- a trigger » — mais c'est une porte ouverte qui ne mène nulle part, et une
-- porte ouverte doit être fermée plutôt qu'expliquée.
--
-- Révoquer `EXECUTE` ne touche pas au déclenchement : Postgres vérifie ce
-- privilège à la *création* du déclencheur, pas à chaque fois qu'il se
-- déclenche. L'inscription, le comptage des étoiles et le retrait automatique
-- continuent donc de fonctionner — vérifié par un compte jetable juste après
-- cette migration.
revoke all on function public.give_a_handle() from public, anon, authenticated;
revoke all on function public.count_the_star() from public, anon, authenticated;
revoke all on function public.withhold_when_reported() from public, anon, authenticated;;
