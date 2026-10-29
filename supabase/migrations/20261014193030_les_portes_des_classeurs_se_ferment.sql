-- Plus personne ne les appelle : le catalogue n'a plus de rayon classeurs, et
-- la fonction `copy` ne connaît plus ce genre.
drop function if exists public.search_folders(
  text, numeric, numeric, double precision, double precision,
  double precision, text, integer, double precision, uuid);
drop function if exists public.copy_folder(uuid);;
