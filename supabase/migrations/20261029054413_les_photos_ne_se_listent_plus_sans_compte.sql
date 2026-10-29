-- Le seau est public pour l'affichage (getPublicUrl ne passe pas par la RLS),
-- mais la policy SELECT ouvrait aussi le listing à `anon` : tous les dossiers,
-- donc tous les comptes, et tous les fichiers, privés compris.
--
-- Désormais on liste et on lit par l'API :
--   - son propre dossier ;
--   - les fichiers du compte bibliothèque, que `copy`, `mend` et `tint` lisent ;
--   - pour la bibliothèque seule, les fichiers d'une entrée partagée, que
--     `judge` copie.
-- Les lignes d'autrui sont invisibles sous RLS : la vérification passe par une
-- fonction security definer, dans un schéma que PostgREST n'expose pas.

create schema private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create function private.photo_readable(path text) returns boolean
language sql stable security definer set search_path = '' as $f$
  with lib as (select p.user_id from public.profiles p where p.library),
       moi_lib as (select exists (select 1 from lib where lib.user_id = (select auth.uid())) as oui)
  select exists (
    select 1 from public.event_photos ep join public.events e on e.id = ep.event_id
    where ep.storage_path = path
      and (e.user_id in (select user_id from lib) or (e.shared and (select oui from moi_lib)))
  ) or exists (
    select 1 from public.character_photos cp join public.characters c on c.id = cp.character_id
    where cp.storage_path = path
      and (c.user_id in (select user_id from lib) or (c.shared and (select oui from moi_lib)))
  );
$f$;
revoke all on function private.photo_readable(text) from public;
grant execute on function private.photo_readable(text) to authenticated;

-- Interrogées à chaque fichier listé, et déjà par `erasable_by_me`.
create index if not exists event_photos_storage_path_idx on public.event_photos (storage_path);
create index if not exists character_photos_storage_path_idx on public.character_photos (storage_path);

drop policy "read event photos" on storage.objects;
create policy "read own photos and the library's" on storage.objects
  for select to authenticated
  using (bucket_id = 'event-photos' and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or private.photo_readable(name)));;
