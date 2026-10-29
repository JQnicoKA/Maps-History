-- Les noms qui couvraient deux choses à la fois, découpés.
--
-- Un renommage ne suffit pas ici : ce sont des **tranches** qu'il faut
-- séparer, parce qu'un même nom portait deux États, deux siècles ou deux
-- continents. Le découpage se fait sur l'année quand c'est le temps qui
-- sépare, et sur la position quand c'est la géographie — jamais à l'aveugle.
--
-- Chaque nom nouveau reçoit **le lavis de son parent** : sans cela il
-- retomberait sur la couleur tirée de son nom, et un territoire qu'on vient
-- de renommer changerait de couleur sous les yeux du lecteur.

create or replace function public.fork_polity_wash(ancien text, nouveau text)
returns void
language sql
set search_path to ''
as $$
  insert into public.polity_wash (name, wash)
  select nouveau, w.wash from public.polity_wash w where w.name = ancien
  on conflict (name) do nothing;
$$;

begin;

-- ---------------------------------------------------------------------------
-- D'abord, lever deux homonymies : la Serbie médiévale et la Serbie moderne
-- portaient les mêmes noms, et la seconde arrive ci-dessous.
-- ---------------------------------------------------------------------------
select public.rename_polity('Principauté de Serbie', 'Principauté serbe médiévale');
select public.rename_polity('Royaume de Serbie', 'Royaume de Serbie médiéval');

-- ---------------------------------------------------------------------------
-- Découpages sur l'année
-- ---------------------------------------------------------------------------

-- « Grande-Bretagne » jusqu'en 2024 : l'union avec l'Irlande date de 1801.
select public.fork_polity_wash('Royaume de Grande-Bretagne', 'Royaume-Uni');
update public.polities set name = 'Royaume-Uni'
where name = 'Royaume de Grande-Bretagne' and start_year >= 1800
  and st_x(anchor) < 10;

-- Naples : le royaume napoléonien commence en 1806, pas en 1762.
update public.polities set name = 'Royaume de Naples'
where name = 'Royaume de Naples (napoléonien)' and end_year < 1806;

-- Les deux soulèvements hongrois, séparés par un siècle.
select public.fork_polity_wash('Nationalistes hongrois', 'Hongrie révolutionnaire');
select public.fork_polity_wash('Nationalistes hongrois', 'Insurrection de Budapest');
update public.polities set name = 'Hongrie révolutionnaire'
where name = 'Nationalistes hongrois' and start_year < 1900;
update public.polities set name = 'Insurrection de Budapest'
where name = 'Nationalistes hongrois';

-- La Serbie : trois régimes sous un seul mot.
select public.fork_polity_wash('Serbes', 'Serbie insurgée');
select public.fork_polity_wash('Serbes', 'Principauté de Serbie');
select public.fork_polity_wash('Serbes', 'Royaume de Serbie');
update public.polities set name = 'Serbie insurgée'
where name = 'Serbes' and end_year <= 1813;
update public.polities set name = 'Principauté de Serbie'
where name = 'Serbes' and start_year <= 1879;
update public.polities set name = 'Royaume de Serbie' where name = 'Serbes';

-- L'Estado Novo portugais : le régime finit en 1974, et la tranche d'après
-- n'est que l'enclave de Cabinda.
select public.fork_polity_wash('Estado Novo', 'Cabinda');
update public.polities set name = 'Cabinda'
where name = 'Estado Novo' and start_year > 1975;
update public.polities set name = 'Afrique portugaise'
where name = 'Estado Novo';

-- Les moudjahidines : l'Afghanistan, puis l'État islamique qui en est sorti,
-- puis — tout autre chose — la rébellion syrienne.
select public.fork_polity_wash('Moudjahidines', 'Rébellion syrienne');
select public.fork_polity_wash('Moudjahidines', 'État islamique d''Afghanistan');
select public.fork_polity_wash('Moudjahidines', 'Moudjahidines afghans');
update public.polities set name = 'Rébellion syrienne'
where name = 'Moudjahidines' and st_x(anchor) < 50;
update public.polities set name = 'État islamique d''Afghanistan'
where name = 'Moudjahidines' and start_year >= 1992;
update public.polities set name = 'Moudjahidines afghans' where name = 'Moudjahidines';

-- ---------------------------------------------------------------------------
-- Découpages sur la position
-- ---------------------------------------------------------------------------

-- « Nouvelle-Néerlande » couvrait trois colonies : New York, le Brésil
-- néerlandais et la Guyane. Trois continents sous un nom.
select public.fork_polity_wash('Nouvelle-Néerlande', 'Brésil néerlandais');
select public.fork_polity_wash('Nouvelle-Néerlande', 'Guyane néerlandaise');
update public.polities set name = 'Brésil néerlandais'
where name = 'Nouvelle-Néerlande' and st_x(anchor) between -45 and -30;
update public.polities set name = 'Guyane néerlandaise'
where name = 'Nouvelle-Néerlande' and st_x(anchor) > -65;

-- « Antilles néerlandaises » posées sur le Suriname.
select public.fork_polity_wash('Antilles néerlandaises', 'Guyane néerlandaise');
update public.polities set name = 'Guyane néerlandaise'
where name = 'Antilles néerlandaises' and st_x(anchor) < -60 and st_y(anchor) < 8;

-- « République batave napoléonienne » : aucune de ses quatre tranches n'est
-- aux Pays-Bas. Deux sont le Cap, deux la Côte-de-l'Or.
select public.fork_polity_wash('République batave napoléonienne', 'Colonie du Cap');
select public.fork_polity_wash('République batave napoléonienne', 'Côte-de-l''Or néerlandaise');
update public.polities set name = 'Côte-de-l''Or néerlandaise'
where name = 'République batave napoléonienne' and st_x(anchor) < 5;
update public.polities set name = 'Colonie du Cap'
where name = 'République batave napoléonienne';

-- Une tranche du Cap étiquetée « Freetown », à six mille kilomètres de là.
update public.polities set name = 'Colonie du Cap'
where name = 'Colonie de Freetown' and st_y(anchor) < 0;

-- Une tranche de Cochinchine étiquetée « Nouvelle-Calédonie ».
select public.fork_polity_wash('Nouvelle-Calédonie', 'Cochinchine française');
update public.polities set name = 'Cochinchine française'
where name = 'Nouvelle-Calédonie' and st_x(anchor) < 150;

-- Saint-Domingue étiquetée « Louisiane ».
select public.fork_polity_wash('Louisiane française', 'Saint-Domingue');
update public.polities set name = 'Saint-Domingue'
where name = 'Louisiane française' and st_x(anchor) > -80;

-- Les deux premières tranches du « Royaume lagide » sont l'empire
-- d'Alexandre : le royaume ne commence qu'en 305 avant notre ère.
update public.polities set name = 'Empire macédonien'
where name = 'Royaume lagide' and start_year < -320;

commit;;
