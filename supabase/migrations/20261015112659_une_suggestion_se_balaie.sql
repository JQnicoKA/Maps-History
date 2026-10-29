-- Une quatrième sorte de balayage, pour la file du conservateur.
--
-- Sans elle, une copie retouchée resterait dans la file pour toujours : elle
-- ne peut pas être jugée — `judge` refuse les copies — donc aucune ligne de
-- `review` ne viendra jamais l'en sortir. `dismissed` sait déjà faire ça, et
-- le fait par date : une retouche postérieure au balayage ramène la ligne,
-- ce qui est exactement ce qu'on veut d'une suggestion qu'on a déjà lue.
alter table public.dismissed drop constraint dismissed_sort;
alter table public.dismissed add constraint dismissed_sort
  check (sort = any (array['admitted', 'promoted', 'stale', 'suggestion']));;
