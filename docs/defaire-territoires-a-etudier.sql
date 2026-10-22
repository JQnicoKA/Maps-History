-- Défaire « les territoires qu'une étude peut interroger »
-- ========================================================
--
-- À coller dans l'éditeur SQL de Supabase, avec la restauration du code.
--
-- **Rien à reconstruire, et c'est voulu.** Les deux migrations n'ont fait
-- qu'ajouter une fonction de lecture : aucune table, aucune colonne, aucune
-- donnée touchée. Elle lit `polities` et `hidden_polities` telles qu'elles
-- sont, et n'écrit nulle part. La défaire se borne donc à la retirer, et la
-- carte, les dessins et les classeurs ne s'en aperçoivent pas.
--
-- Ce que les migrations avaient fait :
--   1. `territories_to_study(from_year, to_year)` — une fenêtre d'années ;
--   2. reprise en `territories_to_study(part)` — une partie du monde, de tout
--      temps, les années étant devenues l'affaire de l'application. L'ancienne
--      signature a été déposée par la seconde migration : les deux lignes
--      ci-dessous couvrent donc l'un et l'autre état.

begin;

drop function if exists public.territories_to_study(text);
drop function if exists public.territories_to_study(integer, integer);

commit;
