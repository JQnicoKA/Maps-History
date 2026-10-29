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
 *
 * **`security definer`, et il le faut.** La seule politique sur `events` est
 * « les siennes » : sans cela la jointure vers l'entrée de la bibliothèque ne
 * trouve rien, et la fonction répond paisiblement qu'il n'y a jamais rien de
 * neuf. Elle ne rend que les lignes du lecteur, et c'est le `where` qui l'y
 * tient — comme les six portes du catalogue.
 */
create or replace function public.stale()
returns table (kind text, id uuid, title text, touched boolean)
language sql stable security definer
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

revoke execute on function public.stale() from public, anon;;
