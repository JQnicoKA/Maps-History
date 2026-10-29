-- Lesquels de ces fichiers puis-je effacer sans casser la collection d'un autre.
--
-- Postgres ne peut pas effacer les octets d'un fichier : le schéma `storage`
-- n'expose que des métadonnées, et ni `pg_net` ni `http` ne sont installés.
-- Mais il peut répondre à la seule question que le client ne peut pas se poser
-- lui-même, parce que la RLS lui cache les lignes des autres : **est-ce que
-- quelqu'un d'autre pointe encore ce fichier ?**
--
-- D'où ce partage des rôles : cette porte dit lesquels sont libres, le client
-- les efface via l'API de stockage, où il a déjà le droit d'agir sur son propre
-- dossier. Si le client meurt entre les deux, il reste un fichier orphelin —
-- pas une image cassée. L'échec tombe du bon côté, et c'est le seul critère.
--
-- Pourquoi ce n'est pas théorique : une copie se fait en deux temps — la porte
-- `copy_*` insère les lignes photo en pointant les fichiers de l'auteur, puis
-- la duplication les déplace vers le dossier du copieur. Quand le second temps
-- échoue, la ligne reste sur le fichier de l'auteur. Mesuré le 2 octobre 2026 :
-- une ligne sur soixante-quinze était dans cet état.
create or replace function public.erasable_by_me(paths text[])
returns setof text
language sql
stable
security definer
set search_path to ''
as $$
  select p
  from unnest(paths) as p
  where
    -- Le dossier de l'appelant, et lui seul. Le reste, il ne pourrait pas
    -- l'effacer de toute façon — la policy de stockage l'interdit — et
    -- répondre à son sujet serait lui apprendre quelque chose sur la
    -- collection d'autrui.
    (storage.foldername(p))[1] = auth.uid()::text

    -- Et seulement si rien qui appartienne à un autre compte ne le réclame.
    -- « Un autre compte » et non « une autre ligne » : à la suppression d'un
    -- compte, toutes les lignes de l'appelant s'en vont en cascade, donc
    -- elles ne comptent pas comme des références survivantes.
    and not exists (
      select 1
      from public.event_photos ep
      join public.events e on e.id = ep.event_id
      where ep.storage_path = p and e.user_id <> auth.uid()
    )
    and not exists (
      select 1
      from public.character_photos cp
      join public.characters c on c.id = cp.character_id
      where cp.storage_path = p and c.user_id <> auth.uid()
    )
    and not exists (
      select 1
      from public.folders f
      where f.photo_path = p and f.user_id <> auth.uid()
    );
$$;

comment on function public.erasable_by_me(text[]) is
  'Parmi ces chemins, ceux du dossier de l''appelant que plus aucun autre compte ne référence. Le client efface ensuite lui-même, via l''API de stockage.';

revoke all on function public.erasable_by_me(text[]) from public, anon;
grant execute on function public.erasable_by_me(text[]) to authenticated;;
