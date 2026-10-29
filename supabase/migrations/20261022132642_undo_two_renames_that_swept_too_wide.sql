-- Deux renommages qui ont ramassé plus large qu'ils ne devaient.
--
-- **Le premier est de ma main.** Après avoir sorti le Royaume-Uni des
-- tranches postérieures à 1800, j'ai renommé *tout ce qui restait* en
-- « Arabie sous protection britannique » — en oubliant que ce qui restait
-- comprenait aussi les sept tranches d'avant 1800, qui sont les îles
-- Britanniques et qui portaient le bon nom. Un renommage en bloc après un
-- découpage partiel : il fallait reprendre la condition de position, pas
-- supposer que le reste était homogène.
--
-- **Le second préexistait.** « Royaume de Serbie » mêlait déjà le royaume
-- médiéval (1188-1351) et une tranche de 1880-1884, c'est-à-dire le royaume
-- moderne à sa naissance. En le renommant « médiéval » d'un bloc, j'ai donc
-- étiqueté un XIXe siècle comme médiéval. La tranche rejoint le royaume
-- moderne, auquel elle appartient.
begin;

update public.polities set name = 'Royaume de Grande-Bretagne'
where name = 'Arabie sous protection britannique' and st_x(anchor) < 10;

select public.fork_polity_wash('Arabie sous protection britannique',
                               'Royaume de Grande-Bretagne');

update public.polities set name = 'Royaume de Serbie'
where name = 'Royaume de Serbie médiéval' and start_year > 1500;

commit;

insert into public.polity_corrections (avant, apres, pourquoi, tranches) values
  ('Arabie sous protection britannique','Royaume de Grande-Bretagne',
   'Sept tranches britanniques ramassées à tort par un renommage en bloc', 7),
  ('Royaume de Serbie médiéval','Royaume de Serbie',
   'Une tranche de 1880-1884 étiquetée médiévale : elle est le royaume moderne', 1);;
