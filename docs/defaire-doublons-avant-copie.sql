-- Défaire « on vous prévient si vous avez déjà quelque chose qui ressemble »
-- ==========================================================================
--
-- À coller dans l'éditeur SQL de Supabase. Ces deux fonctions ne sont lues
-- que par l'avertissement affiché avant de copier une entrée : les déposer
-- ne touche à aucune donnée, et ne retire rien à ce qui est déjà copié.
--
-- À faire avec la restauration du code, ou après : l'application appelle
-- `my_events_like` et `my_characters_like` avant d'ouvrir la confirmation de
-- copie — et elle est écrite pour que l'échec de cet appel **n'empêche
-- jamais** de copier. Les déposer sans restaurer le code laisse donc une
-- application qui marche, simplement sans l'avertissement.

begin;

drop function if exists public.my_events_like(text, integer, boolean);
drop function if exists public.my_characters_like(text, integer, boolean);

commit;
