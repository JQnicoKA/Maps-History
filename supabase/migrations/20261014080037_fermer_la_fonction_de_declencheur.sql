-- `touch_parent` est une fonction de déclencheur, pas une porte.
--
-- Elle était joignable en RPC par n'importe qui, `anon` compris, et elle est
-- `security definer` : appelée à la main elle n'aurait rien fait d'utile — un
-- déclencheur sans `new` ni `tg_argv` lève une erreur — mais une fonction
-- privilégiée exposée sans raison est une fonction qu'on oublie. Un
-- déclencheur n'a pas besoin du droit d'exécution pour se déclencher : il
-- court sous le propriétaire de la table. Même traitement que
-- `count_the_star`, déjà fermée.
revoke execute on function public.touch_parent() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;;
