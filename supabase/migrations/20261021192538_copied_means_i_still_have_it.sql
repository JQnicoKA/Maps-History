-- « Déjà copié » veut dire « je l'ai », et non « je l'ai pris un jour ».
--
-- Le drapeau se lisait dans `copies`, la table qui enregistre qu'on a pris
-- quelque chose. Or on n'en retire jamais rien : supprimer sa copie laissait
-- donc l'entrée marquée « déjà copié » pour toujours, et il devenait
-- impossible de la reprendre.
--
-- **La table avait deux métiers qui se contredisent.** Un déclencheur y
-- compte les étoiles à l'insertion — « ce que d'autres ont trouvé bon à
-- garder » — et ce compte-là doit être historique : il ne se décrémente pas,
-- sans quoi il dirait autre chose. Mais le drapeau, lui, doit dire le
-- présent. Vider la ligne aurait corrigé le drapeau et fait recompter une
-- étoile à la copie suivante.
--
-- Chacun reprend donc son métier : `copies` reste le registre des étoiles,
-- et « je l'ai » se déduit de ce que j'ai — une de mes lignes dont la
-- filiation pointe vers cette entrée. C'est vrai par construction, et ça se
-- répare tout seul : supprimer ma copie emporte sa filiation avec elle.
--
-- Pour défaire : docs/defaire-copie-deduite.sql
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

    d := regexp_replace(
      d,
      'select 1 from public\.copies \w+\s+where \w+\.kind = ''event''\s+and \w+\.source_id = e\.id\s+and \w+\.user_id = auth\.uid\(\)',
      'select 1 from public.events mine' || chr(10) ||
      '        where mine.origin_id = e.id and mine.user_id = auth.uid()',
      'g'
    );
    d := regexp_replace(
      d,
      'select 1 from public\.copies \w+\s+where \w+\.kind = ''character''\s+and \w+\.source_id = c\.id\s+and \w+\.user_id = auth\.uid\(\)',
      'select 1 from public.characters mine' || chr(10) ||
      '        where mine.origin_id = c.id and mine.user_id = auth.uid()',
      'g'
    );
    d := regexp_replace(
      d,
      'select 1 from public\.copies \w+\s+where \w+\.kind = ''tree''\s+and \w+\.source_id = t\.id\s+and \w+\.user_id = auth\.uid\(\)',
      'select 1 from public.trees mine' || chr(10) ||
      '        where mine.origin_id = t.id and mine.user_id = auth.uid()',
      'g'
    );

    if d like '%public.copies%' then
      raise exception 'la substitution a manqué dans %', cible.nom;
    end if;

    execute d;
  end loop;
end $$;;
