-- Défaire « déjà copié veut dire je l'ai encore »
-- ===============================================
--
-- À coller dans l'éditeur SQL de Supabase. Ce script ne touche à aucune
-- donnée : il ne fait que rendre aux huit fonctions leur ancienne façon de
-- calculer le drapeau `copied`.
--
-- Ce que la migration `copied_means_i_still_have_it` avait fait : le drapeau
-- se lisait dans `copies`, la table qui enregistre qu'on a pris quelque
-- chose et dont on ne retire jamais rien. Supprimer sa copie laissait donc
-- l'entrée marquée « déjà copié » pour toujours. Il se déduit désormais de
-- la filiation d'une de ses propres lignes, ce qui se répare tout seul.
--
-- **Revenir en arrière ramène le défaut**, et rien d'autre : `copies` n'a
-- jamais cessé d'être tenue à jour, donc l'ancien calcul retrouve exactement
-- ce qu'il lisait avant.
do $$
declare
  cible record;
  d text;
begin
  for cible in
    select unnest(array[
      'events_like', 'search_events', 'shared_event',
      'characters_like', 'search_characters', 'shared_character',
      'search_trees', 'shared_tree'
    ]) as nom
  loop
    select pg_get_functiondef(p.oid) into strict d
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = cible.nom;

    d := replace(
      d,
      'select 1 from public.events mine' || chr(10) ||
      '        where mine.origin_id = e.id and mine.user_id = auth.uid()',
      'select 1 from public.copies c' || chr(10) ||
      '        where c.kind = ''event'' and c.source_id = e.id and c.user_id = auth.uid()'
    );
    d := replace(
      d,
      'select 1 from public.characters mine' || chr(10) ||
      '        where mine.origin_id = c.id and mine.user_id = auth.uid()',
      'select 1 from public.copies k' || chr(10) ||
      '        where k.kind = ''character'' and k.source_id = c.id and k.user_id = auth.uid()'
    );
    d := replace(
      d,
      'select 1 from public.trees mine' || chr(10) ||
      '        where mine.origin_id = t.id and mine.user_id = auth.uid()',
      'select 1 from public.copies c' || chr(10) ||
      '        where c.kind = ''tree'' and c.source_id = t.id and c.user_id = auth.uid()'
    );

    execute d;
  end loop;
end $$;
