-- Les exemplaires déjà pris ne sont pas en retard.
--
-- `taken_at` leur avait été donné d'après leur `created_at`, faute de mieux.
-- Mais la migration qui a publié la bibliothèque a touché l'`updated_at` des
-- quarante entrées — un `update` déclenche `touch_updated_at`, c'est tout son
-- métier — et ces exemplaires se seraient donc crus en retard d'une
-- correction qui n'a jamais eu lieu. Le premier geste du lecteur aurait été
-- de se voir proposer une mise à jour vide, avec un avertissement sur des
-- modifications à écraser. Mauvaise première impression pour une mécanique
-- dont tout l'intérêt est la confiance.
--
-- Ils sont donc déclarés à jour maintenant : c'est exact, puisque leur
-- contenu est bien celui de l'entrée telle qu'elle est aujourd'hui.
update public.events set taken_at = now()
  where origin_id is not null and taken_at is not null;
update public.characters set taken_at = now()
  where origin_id is not null and taken_at is not null;
update public.folders set taken_at = now()
  where origin_id is not null and taken_at is not null;
update public.trees set taken_at = now()
  where origin_id is not null and taken_at is not null;;
