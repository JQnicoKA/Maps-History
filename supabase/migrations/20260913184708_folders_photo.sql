-- Une photo de couverture par classeur, dans le même bucket que celles des
-- événements. Elle sert de repli au marqueur sur la carte : photo de
-- l'événement, sinon photo de son classeur, sinon l'emoji de son type.
alter table public.folders
  add column if not exists photo_path text;;
