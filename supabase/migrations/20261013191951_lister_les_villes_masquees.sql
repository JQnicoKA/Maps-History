-- Ce que ce compte a ôté de sa carte, avec le nom de chacun.
--
-- Le masque ne retient qu'un `ohm_id`, exprès — c'est la seule clé qui
-- survive à un rechargement de l'extrait. Mais une liste d'entiers ne se
-- montre pas à un lecteur, alors le nom est repris de `places` au moment de
-- lire. Jointure et non clé étrangère : une clé étrangère ferait tomber les
-- masques avec la table le jour où on la recharge, ce qui est précisément ce
-- qu'on cherche à éviter.
--
-- Un lieu masqué puis disparu de l'extrait garde donc sa ligne et perd son
-- nom. Il ne coûte rien et redeviendra lisible si le lieu revient.
create or replace function public.my_hidden_places()
returns table (ohm_id bigint, name text)
language sql stable
set search_path to ''
as $$
  select h.ohm_id, p.name
  from public.hidden_places h
  left join public.places p on p.ohm_id = h.ohm_id
  where h.user_id = auth.uid()
  order by h.hidden_at desc;
$$;

revoke execute on function public.my_hidden_places() from public, anon;;
