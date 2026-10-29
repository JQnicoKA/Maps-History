-- Les classeurs et les arbres n'entrent pas encore.
--
-- Deux décisions se sont croisées : « on laisse tout l'existant dans la
-- bibliothèque », prise quand les classeurs en faisaient partie, puis « au
-- début uniquement les événements, je fabriquerai les classeurs moi-même
-- quand le corpus sera fourni ». La seconde est plus récente et plus précise,
-- donc elle gagne — et elle est cohérente avec son propre argument : un
-- classeur est une habitude de rangement, et les trois qui existent sont le
-- rangement personnel du conservateur, pas une collection éditoriale.
--
-- Rien n'est perdu : les lignes sont là, et un `update` d'une ligne les
-- publiera le jour voulu. En attendant les deux portes s'endorment d'
-- elles-mêmes — elles lisent la bibliothèque, la bibliothèque n'en a pas, le
-- message de vide s'affiche. Aucun cas particulier dans le code.
update public.folders set published = false where published;
update public.trees set published = false where published;;
