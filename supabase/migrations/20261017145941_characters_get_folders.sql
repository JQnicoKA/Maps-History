-- Les personnages prennent le classement des événements, et c'est le **même**
-- classeur : des noms dans un tableau de texte, pas une entité. Un lecteur qui
-- range « Révolution française » range ses batailles et ses figures ensemble.
--
-- Pas d'index : les événements n'en ont pas non plus. Le filtrage se fait en
-- mémoire, sur une collection déjà chargée en entier — la base ne voit jamais
-- passer une requête sur cette colonne.
alter table public.characters
  add column if not exists folders text[] not null default '{}';

-- La copie emporte le classement, comme celle d'un événement. C'est tout
-- l'intérêt d'un classeur sans entité : qui prend trois Carolingiens les
-- reçoit groupés, là où un classeur-ligne serait resté chez son auteur.
create or replace function public.copy_one_character(source_id uuid, me uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  source public.characters%rowtype;
  made uuid;
begin
  select * into source from public.characters c where c.id = source_id;
  if not found then
    return null;
  end if;

  select c.id into made
  from public.characters c
  where c.user_id = me
    and (c.origin_id = source.id or c.id = source.id)
  limit 1;
  if made is not null then
    return made;
  end if;

  -- Voir `copy_one_event` : la copie arrive ouverte, par défaut de colonne.
  insert into public.characters (
    user_id, name, bio,
    birth_year, birth_month, birth_day, birth_approx,
    death_year, death_month, death_day, death_approx,
    longitude, latitude, folders, origin_id, taken_at
  ) values (
    me, source.name, source.bio,
    source.birth_year, source.birth_month, source.birth_day, source.birth_approx,
    source.death_year, source.death_month, source.death_day, source.death_approx,
    source.longitude, source.latitude, source.folders, source.id, now()
  ) returning id into made;

  insert into public.character_photos (
    character_id, storage_path, position, source, tint, tinted_at
  )
  select made, p.storage_path, p.position, p.source, p.tint, p.tinted_at
  from public.character_photos p where p.character_id = source.id;

  insert into public.copies (kind, source_id, user_id)
  values ('character', source.id, me) on conflict do nothing;

  return made;
end;
$function$;;
