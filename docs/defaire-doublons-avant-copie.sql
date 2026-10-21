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


-- 2. Rendre à la ressemblance son sens unique
-- -------------------------------------------
--
-- `word_similarity(aiguille, botte)` n'est pas symétrique : « Thierry »
-- tient tout entier dans « Thierry Ier » (1,00), l'inverse non (0,727). Les
-- deux sens de la question ne répondaient donc pas pareil, et la migration
-- `word_similarity_both_ways` a pris le plus grand des deux.
--
-- Ce bloc ne concerne que `events_like` et `characters_like`, qui existaient
-- avant : les deux autres partent avec le bloc ci-dessus. **Revenir en
-- arrière ramène l'asymétrie**, donc le défaut — mais c'est l'état d'avant,
-- au caractère près.
do $$
declare
  cible text;
  d text;
begin
  foreach cible in array array['events_like', 'characters_like']
  loop
    select pg_get_functiondef(p.oid) into strict d
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = cible;

    d := regexp_replace(
      d,
      'greatest\(extensions\.word_similarity\(public\.plain\(said\), public\.plain\((\w+\.\w+)\)\), extensions\.word_similarity\(public\.plain\(\1\), public\.plain\(said\)\)\)',
      'extensions.word_similarity(public.plain(said), public.plain(\1))',
      'g'
    );

    execute d;
  end loop;
end $$;
