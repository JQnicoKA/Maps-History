-- Les territoires OpenHistoricalMap ne sont plus la source des frontières
-- depuis le passage à Cliopatria, et ils occupaient 76 Mo des 130 Mo de la
-- base — plus que tout le reste réuni. Ils se reconstruisent en entier avec
-- `scripts/extract-territories.mjs` puis `scripts/load-territories.mjs`, qui
-- restent au dépôt : ce n'est pas une donnée unique, c'est un cache d'une
-- extraction publique.
--
-- Les deux fonctions partent avec la table : sans elle, elles ne pourraient
-- plus qu'échouer.
drop function if exists public.territories_by_ids(uuid[]);
drop function if exists public.territory_ids_at(numeric, integer);

drop table if exists public.territory_fragments;
drop table if exists public.territories;;
