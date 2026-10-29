-- Les derniers noms franchement faux, repliés sur le bon.
--
-- Chacun est une tranche posée au mauvais endroit ou au mauvais siècle, dont
-- la bonne identité se lit sans ambiguïté sur sa forme et ses dates.
begin;

-- « Afrique-Équatoriale française » en 1842 : l'AEF date de 1910, la forme est
-- en Algérie, et l'Algérie française existe déjà dans la base.
select public.rename_polity('Afrique-Équatoriale française', 'Algérie française');

-- « Protectorat du Qatar » posé sur Oman, 307 000 km² : c'est le sultanat de
-- Mascate et Oman, qui existe déjà.
select public.rename_polity('Protectorat du Qatar', 'Sultanat de Mascate et Oman');

-- « République populaire de Zanzibar » en 1856 : elle date de 1964. Ce que la
-- carte montre alors est le sultanat, qui existe déjà.
select public.rename_polity('République populaire de Zanzibar', 'Sultanat de Zanzibar');

-- « Grands Yuan » de −110 à 50, cinquante mille kilomètres carrés en
-- Ferghana : ce n'est pas la dynastie Yuan (1271-1368) mais **Dayuan**, le
-- royaume que les Han connaissaient au bout de la route de la soie. La
-- confusion vient du nom lui-même — 大宛 et 大元 se ressemblent en anglais.
select public.rename_polity('Grands Yuan', 'Dayuan (Ferghana)');

-- Les deux tranches d'Arabie étiquetées « Grande-Bretagne » : ce sont les
-- États arabes sous protection britannique, non les îles Britanniques.
select public.rename_polity('Royaume de Grande-Bretagne', 'Arabie sous protection britannique');

commit;

insert into public.polity_corrections (avant, apres, pourquoi, tranches) values
  ('Royaume de Grande-Bretagne','Royaume-Uni','L''union avec l''Irlande date de 1801', 31),
  ('Royaume de Naples (napoléonien)','Royaume de Naples','Le royaume napoléonien commence en 1806', 4),
  ('Nationalistes hongrois','Hongrie révolutionnaire','1849 et 1956 sont deux épisodes sans rapport', 1),
  ('Nationalistes hongrois','Insurrection de Budapest','1849 et 1956 sont deux épisodes sans rapport', 1),
  ('Serbes','Serbie insurgée','Trois régimes sous un seul mot', 1),
  ('Serbes','Principauté de Serbie','Trois régimes sous un seul mot', 8),
  ('Serbes','Royaume de Serbie','Trois régimes sous un seul mot', 5),
  ('Principauté de Serbie','Principauté serbe médiévale','Homonymie avec la Serbie moderne', 1),
  ('Royaume de Serbie','Royaume de Serbie médiéval','Homonymie avec la Serbie moderne', 1),
  ('Estado Novo','Afrique portugaise','Le régime finit en 1974 ; la forme est l''Afrique portugaise', 11),
  ('Estado Novo','Cabinda','La tranche d''après 1975 n''est que l''enclave', 2),
  ('Moudjahidines','Moudjahidines afghans','Distingué de la rébellion syrienne', 2),
  ('Moudjahidines','État islamique d''Afghanistan','L''État issu des moudjahidines portait un nom', 1),
  ('Moudjahidines','Rébellion syrienne','Deux tranches de Syrie sous un nom afghan', 2),
  ('Nouvelle-Néerlande','Brésil néerlandais','Trois colonies sous un nom', 6),
  ('Nouvelle-Néerlande','Guyane néerlandaise','Trois colonies sous un nom', 9),
  ('Antilles néerlandaises','Guyane néerlandaise','Deux tranches du Suriname prises pour les Antilles', 2),
  ('République batave napoléonienne','Colonie du Cap','Aucune tranche n''est aux Pays-Bas', 2),
  ('République batave napoléonienne','Côte-de-l''Or néerlandaise','Aucune tranche n''est aux Pays-Bas', 2),
  ('Colonie de Freetown','Colonie du Cap','Une tranche du Cap à six mille kilomètres de Freetown', 1),
  ('Nouvelle-Calédonie','Cochinchine française','Une tranche du Viêt Nam', 1),
  ('Louisiane française','Saint-Domingue','Une tranche d''Haïti', 1),
  ('Royaume lagide','Empire macédonien','Le royaume lagide ne commence qu''en −305', 2),
  ('Afrique-Équatoriale française','Algérie française','L''AEF date de 1910 ; la forme est en Algérie', 2),
  ('Protectorat du Qatar','Sultanat de Mascate et Oman','La forme est Oman, non le Qatar', 2),
  ('République populaire de Zanzibar','Sultanat de Zanzibar','La république date de 1964', 2),
  ('Grands Yuan','Dayuan (Ferghana)','Dayuan, non la dynastie Yuan : 大宛 et 大元 se confondent', 4),
  ('Royaume de Grande-Bretagne','Arabie sous protection britannique','Deux tranches d''Arabie', 2);;
