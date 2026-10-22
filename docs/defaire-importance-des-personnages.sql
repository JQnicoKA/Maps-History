-- Défaire « les personnages portent leur importance »
-- ====================================================
--
-- À coller dans l'éditeur SQL de Supabase, avec la restauration du code.
--
-- **La colonne `tree_members.importance` a été déposée**, à la demande. Ce
-- script la reconstruit donc au lieu de la ressusciter : chaque membre
-- reprend l'importance du personnage qu'il montre, ce qui redonne exactement
-- le même dessin par l'ancien chemin.
--
-- Ce qui ne revient pas : le réglage **par arbre**. Si un roi était majeur
-- dans une lignée et discret dans une autre, cette nuance a disparu au
-- moment de la bascule — elle avait été ramenée à la plus forte des deux —
-- et rien ne peut la retrouver.
--
-- Ce que les migrations avaient fait :
--   1. `characters.importance`, semée depuis les arbres ;
--   2. `copy_one_character` qui l'emporte avec la copie ;
--   3. `tree_members.importance` déposée, et `copy_tree` et `shared_tree`
--      reprises pour cesser de la lire.

begin;

-- 1. La colonne des membres, refaite et re-semée depuis les personnages.
alter table public.tree_members
  add column if not exists importance text not null default 'medium';

alter table public.tree_members
  add constraint tree_members_importance_check
  check (importance = any (array['high', 'medium', 'low']));

update public.tree_members m
   set importance = c.importance::text
  from public.characters c
 where c.id = m.character_id;

-- 2. Les deux fonctions qui la recopiaient.
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into strict d
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'copy_tree';
  d := replace(
    d,
    'tree_id, character_id, generation, position, note',
    'tree_id, character_id, generation, position, importance, note'
  );
  d := replace(
    d,
    'made, theirs, member.generation, member.position, member.note',
    'made, theirs, member.generation, member.position, member.importance,' ||
    chr(10) || '        member.note'
  );
  execute d;

  select pg_get_functiondef(p.oid) into strict d
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'shared_tree';
  d := replace(
    d,
    '''position'', m.position',
    '''position'', m.position,' || chr(10) || '                 ''importance'', m.importance'
  );
  execute d;
end $$;

-- 3. La copie d'un personnage cesse d'emporter l'importance.
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into strict d
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'copy_one_character';
  d := replace(
    d,
    'longitude, latitude, folders, importance, origin_id, taken_at',
    'longitude, latitude, folders, origin_id, taken_at'
  );
  d := replace(
    d,
    'source.longitude, source.latitude, source.folders, source.importance, source.id, now()',
    'source.longitude, source.latitude, source.folders, source.id, now()'
  );
  execute d;
end $$;

-- 4. Et la colonne des personnages s'en va.
alter table public.characters drop column if exists importance;

commit;
