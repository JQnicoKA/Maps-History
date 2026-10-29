-- Étape 3 du pipeline : la table est entièrement régénérée depuis
-- public.territory_fragments, qui vient d'être rechargée (42 956 fragments,
-- niveaux 2 à 4). Voir scripts/stitch-territories.sql et docs/territoires.md.
delete from public.territories;;
