-- Une copie emporte l'importance du personnage.
--
-- `copy_one_character` recopie champ par champ, et la colonne est née après
-- elle : un personnage pris dans la bibliothèque serait arrivé « moyen »
-- quel que soit le poids que son auteur lui avait donné. Le classement et
-- les dates partent déjà avec la copie ; l'importance est de la même nature.
--
-- Pour défaire : docs/defaire-importance-des-personnages.sql
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into strict d
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'copy_one_character';

  d := replace(
    d,
    'longitude, latitude, folders, origin_id, taken_at',
    'longitude, latitude, folders, importance, origin_id, taken_at'
  );
  d := replace(
    d,
    'source.longitude, source.latitude, source.folders, source.id, now()',
    'source.longitude, source.latitude, source.folders, source.importance,' ||
    ' source.id, now()'
  );

  if d not like '%source.importance%' then
    raise exception 'la substitution a manqué dans copy_one_character';
  end if;

  execute d;
end $$;;
