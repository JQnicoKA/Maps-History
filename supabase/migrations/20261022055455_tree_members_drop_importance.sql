-- L'appartenance à un arbre ne porte plus d'importance.
--
-- Elle y vivait, et elle a déménagé sur le personnage : un roi pèse ce qu'il
-- pèse dans la collection, pas dessin par dessin. La colonne a servi une
-- dernière fois à semer la nouvelle — la plus forte place que chacun
-- occupait — et plus rien ne la lit.
--
-- Deux fonctions la recopiaient encore, et il faut les reprendre **avant**
-- de déposer la colonne : `copy_tree`, qui emportait l'importance de chaque
-- membre avec l'arbre, et `shared_tree`, qui la publiait dans la fiche d'un
-- arbre de la bibliothèque. Un personnage copié apporte désormais la sienne,
-- ce qui donne le même dessin par le bon chemin.
--
-- Pour défaire : docs/defaire-importance-des-personnages.sql — qui la
-- reconstruit depuis les personnages au lieu de la ressusciter, puisqu'elle
-- n'existera plus.
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into strict d
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'copy_tree';
  d := replace(
    d,
    'tree_id, character_id, generation, position, importance, note',
    'tree_id, character_id, generation, position, note'
  );
  d := replace(
    d,
    'made, theirs, member.generation, member.position, member.importance,' || chr(10) ||
    '        member.note',
    'made, theirs, member.generation, member.position, member.note'
  );
  if d like '%importance%' then
    raise exception 'copy_tree lit encore importance';
  end if;
  execute d;

  select pg_get_functiondef(p.oid) into strict d
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'shared_tree';
  d := regexp_replace(d, ',\s*''importance'',\s*m\.importance', '', 'g');
  if d like '%importance%' then
    raise exception 'shared_tree lit encore importance';
  end if;
  execute d;
end $$;

alter table public.tree_members drop column importance;;
