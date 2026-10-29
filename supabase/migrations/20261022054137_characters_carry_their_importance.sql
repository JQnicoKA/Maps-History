-- Un personnage porte son importance, comme un événement.
--
-- Elle vivait sur l'appartenance à un arbre — `tree_members.importance` —
-- donc le même roi pouvait être majeur dans une lignée et discret dans une
-- autre. C'était défendable et ce n'est plus ce qu'on veut : l'importance
-- dit ce que quelqu'un pèse dans la collection, pas dans un dessin.
--
-- Les arbres la liront désormais sur le personnage. La colonne des membres
-- **n'est pas déposée** : elle porte ce que le lecteur a réglé jusqu'ici, et
-- c'est d'elle que la nouvelle est semée ci-dessous. La retirer sera une
-- décision à part, une fois qu'on sera sûr de ne plus la vouloir.
--
-- Pour défaire : docs/defaire-importance-des-personnages.sql
alter table public.characters
  add column if not exists importance public.event_importance
  not null default 'medium';

comment on column public.characters.importance is
  'Ce que ce personnage pèse dans la collection. Les arbres s''en servent pour le poids de son nœud ; voir tree_members.importance, qui ne sert plus.';

-- Semée depuis ce que le lecteur avait déjà réglé dans ses arbres.
--
-- La plus forte des places qu'il occupe, et non la dernière ni la moyenne :
-- quelqu'un marqué majeur dans une lignée l'est, même s'il n'est qu'une
-- mention dans une autre. C'est le seul choix qui ne perd rien.
update public.characters c
   set importance = fort.plus_forte
  from (
    select m.character_id,
           (array['low','medium','high'])[
             max(array_position(array['low','medium','high'], m.importance))
           ]::public.event_importance as plus_forte
    from public.tree_members m
    where m.character_id is not null
    group by m.character_id
  ) as fort
 where fort.character_id = c.id
   and c.importance = 'medium';;
