-- Une copie n'est plus condamnée au silence.
--
-- La règle disait : une copie reste chez soi, parce que la bibliothèque tient
-- déjà l'entrée dont elle vient et qu'une copie n'a donc rien à offrir. Elle a
-- été écrite quand la case « ouvert à la bibliothèque » voulait dire *publier*
-- — alors oui, republier ce qu'on venait de prendre n'aurait fait qu'un
-- doublon de plus dans la jungle.
--
-- La case ne veut plus dire cela. Elle veut dire **« la bibliothèque peut
-- s'inspirer de ceci »**, et une copie retouchée a précisément de quoi
-- l'inspirer : qui prend une entrée, la corrige et l'étoffe a fait un travail
-- dont l'entrée d'origine gagnerait à profiter. Le fermer d'office était le
-- dernier reste du modèle précédent.
--
-- Ce qui ne change pas : `judge` refuse toujours d'**admettre** une copie. La
-- reprendre comme entrée neuve ferait le doublon que tout ceci évite. S'en
-- inspirer pour corriger l'entrée d'origine est un autre geste.
alter table public.events drop constraint events_copies_stay_private;
alter table public.characters drop constraint characters_copies_stay_private;;
