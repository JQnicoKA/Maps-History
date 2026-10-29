/**
 * Ce qui, chez moi, a pris du retard sur la bibliothèque.
 *
 * Rien n'est appliqué ici : on ne fait que répondre « il y a du neuf sur
 * celle-ci, et voilà si tu y as touché ». La mise à jour est un geste du
 * lecteur, jamais une migration silencieuse de sa carte — c'était tout
 * l'argument contre la propagation automatique, qui aurait fait glisser
 * Marignan de 1515 à 1516 pendant la nuit.
 *
 * `touched` décide du ton de l'avertissement : rien à perdre, ou des
 * modifications qui seront écrasées.
 *
 * Une entrée dépubliée ou supprimée cesse d'apparaître ici d'elle-même — la
 * jointure exige `published`. C'est le détachement promis, et il n'a demandé
 * aucune ligne de code : l'exemplaire garde tout, il cesse seulement de se
 * voir proposer des corrections.
 */
create or replace function public.stale()
returns table (kind text, id uuid, title text, touched boolean)
language sql stable
set search_path to ''
as $$
  select 'event'::text, mine.id, mine.title,
         mine.updated_at > mine.taken_at
  from public.events mine
  join public.events entry on entry.id = mine.origin_id and entry.published
  where mine.user_id = auth.uid()
    and mine.taken_at is not null
    and entry.updated_at > mine.taken_at
  union all
  select 'character', mine.id, mine.name,
         mine.updated_at > mine.taken_at
  from public.characters mine
  join public.characters entry on entry.id = mine.origin_id and entry.published
  where mine.user_id = auth.uid()
    and mine.taken_at is not null
    and entry.updated_at > mine.taken_at;
$$;

/**
 * Reprend l'entrée de la bibliothèque dans l'exemplaire qu'on détient.
 *
 * **Tout ou rien, et c'est dit.** L'exemplaire est réécrit entièrement : ses
 * champs, ses photographies, sa distribution. Ce que le lecteur y avait
 * ajouté — une photographie à lui, en particulier — part avec. L'alternative
 * aurait été de ne remplacer que ce qui venait de la bibliothèque, ce qui
 * demande de marquer l'origine de chaque photo et donne une explication que
 * personne ne peut écrire sans mentir. La fenêtre qui précède ce geste nomme
 * donc les photographies, et ne se contente pas de « vos modifications ».
 *
 * La ligne garde son identifiant : les classeurs et les arbres qui la
 * désignent ne doivent rien remarquer.
 */
create or replace function public.refresh_from_library(about text, which uuid)
returns void
language plpgsql security definer
set search_path to ''
as $$
declare
  me uuid := auth.uid();
  entry_id uuid;
  cast_member uuid;
begin
  if me is null then
    raise exception 'Il faut être connecté.';
  end if;

  if about = 'event' then
    select e.origin_id into entry_id
    from public.events e where e.id = which and e.user_id = me;
    if entry_id is null then
      raise exception 'Cet événement ne vient pas de la bibliothèque.';
    end if;

    update public.events mine set
      title = entry.title,
      description = entry.description,
      type = entry.type,
      start_year = entry.start_year, start_month = entry.start_month,
      start_day = entry.start_day, start_approx = entry.start_approx,
      end_year = entry.end_year, end_month = entry.end_month,
      end_day = entry.end_day, end_approx = entry.end_approx,
      longitude = entry.longitude, latitude = entry.latitude,
      taken_at = now()
    from public.events entry
    where mine.id = which and mine.user_id = me
      and entry.id = entry_id and entry.published;

    if not found then
      raise exception 'Cette entrée n''est plus dans la bibliothèque.';
    end if;

    delete from public.event_photos where event_id = which;
    insert into public.event_photos (event_id, storage_path, position, source)
    select which, p.storage_path, p.position, p.source
    from public.event_photos p where p.event_id = entry_id;

    delete from public.event_characters where event_id = which;
    for cast_member in
      select ec.character_id from public.event_characters ec
      where ec.event_id = entry_id
    loop
      insert into public.event_characters (event_id, character_id)
      values (which, public.copy_one_character(cast_member, me))
      on conflict do nothing;
    end loop;

  elsif about = 'character' then
    select c.origin_id into entry_id
    from public.characters c where c.id = which and c.user_id = me;
    if entry_id is null then
      raise exception 'Ce personnage ne vient pas de la bibliothèque.';
    end if;

    update public.characters mine set
      name = entry.name,
      bio = entry.bio,
      birth_year = entry.birth_year, birth_month = entry.birth_month,
      birth_day = entry.birth_day, birth_approx = entry.birth_approx,
      death_year = entry.death_year, death_month = entry.death_month,
      death_day = entry.death_day, death_approx = entry.death_approx,
      longitude = entry.longitude, latitude = entry.latitude,
      taken_at = now()
    from public.characters entry
    where mine.id = which and mine.user_id = me
      and entry.id = entry_id and entry.published;

    if not found then
      raise exception 'Cette entrée n''est plus dans la bibliothèque.';
    end if;

    delete from public.character_photos where character_id = which;
    insert into public.character_photos
      (character_id, storage_path, position, source, tint, tinted_at)
    select which, p.storage_path, p.position, p.source, p.tint, p.tinted_at
    from public.character_photos p where p.character_id = entry_id;

  else
    -- Les classeurs et les arbres n'entrent pas encore dans la bibliothèque,
    -- donc aucun exemplaire n'en vient. Le jour où ils y entreront, leur mise
    -- à jour restera distincte de celle de leurs membres : reprendre la
    -- composition d'un classeur ne doit pas écraser les corrections que le
    -- lecteur a faites sur ses propres événements.
    raise exception 'Rien à mettre à jour pour ce genre.';
  end if;
end;
$$;

revoke execute on function public.stale() from public, anon;
revoke execute on function public.refresh_from_library(text, uuid) from public, anon;;
