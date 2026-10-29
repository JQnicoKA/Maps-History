-- 1. Le seau n'accepte plus que des images, et pas de n'importe quel poids.
--
-- Il est public : tout fichier déposé obtient une URL lisible par quiconque la
-- détient. Sans restriction de type, un compte pouvait donc y déposer une page
-- HTML et obtenir une page d'hameçonnage hébergée par notre infrastructure —
-- et sans plafond de taille, rien ne bornait la facture.
--
-- L'application n'envoie que du JPEG (`shrink()`), et les 81 fichiers présents
-- le confirment, le plus gros à 753 ko. Mais `shrink()` a un repli : quand la
-- préparation échoue, le téléphone envoie l'image telle qu'il l'a donnée, donc
-- du HEIC sur iPhone. La liste couvre ce repli, sinon je casserais un chemin
-- qui marche.
--
-- SVG est délibérément absent : c'est une image qui peut porter du script.
update storage.buckets
set allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'
    ],
    -- Treize fois le plus gros fichier existant : assez pour une photo brute
    -- de téléphone passée par le repli, trop peu pour servir d'hébergement.
    file_size_limit = 10485760
where id = 'event-photos';

-- 2. `st_estimatedextent` n'est pas une porte de cette application.
--
-- Fonction PostGIS en `security definer`, appelable jusqu'ici sans même être
-- connecté, et qui livre les statistiques d'emprise des colonnes
-- géométriques. Rien dans l'application ne l'appelle.
revoke execute on function public.st_estimatedextent(text, text) from anon, authenticated;
revoke execute on function public.st_estimatedextent(text, text, text) from anon, authenticated;
revoke execute on function public.st_estimatedextent(text, text, text, boolean) from anon, authenticated;

-- 3. Un profil ne se lit que par son propre titulaire.
--
-- La policy s'appelait « un pseudonyme est public » mais elle était `USING
-- (true)` sur la ligne entière : n'importe quel inscrit pouvait énumérer tous
-- les comptes et lire leur date de création et leur acceptation des
-- conditions. Le nom promettait un pseudonyme, le droit en donnait quatre
-- colonnes.
--
-- Les pseudonymes des autres continuent d'arriver, et c'est le point : ils
-- passent par les portes `shared_*`, `search_*` et `blocked_people`, toutes en
-- `security definer`, qui joignent `profiles` sans être soumises à la RLS.
-- L'application, elle, ne lit jamais que son propre `handle`.
drop policy "un pseudonyme est public" on public.profiles;

create policy "on lit son propre profil" on public.profiles
  for select to authenticated
  using (user_id = (select auth.uid()));;
