-- Les deux tranches du Suriname étiquetées « Antilles néerlandaises ».
--
-- La première tentative les cherchait à l'ouest du 60e méridien ; elles sont
-- à 56° ouest, c'est-à-dire **plus à l'est** que les Antilles elles-mêmes. Ce
-- qui les sépare est la latitude — 4° nord contre 12° pour les îles —, et
-- c'est le genre de condition qu'on écrit juste ou qu'on n'écrit pas.
begin;

select public.fork_polity_wash('Antilles néerlandaises', 'Guyane néerlandaise');

update public.polities set name = 'Guyane néerlandaise'
where name = 'Antilles néerlandaises' and st_y(anchor) < 8;

-- Les lavis des noms qui n'ont plus aucune tranche, après découpage. Ils ne
-- gênent personne, mais une table de couleurs qui garde des couleurs pour des
-- territoires disparus finit par mentir sur ce que la carte contient.
-- « État d'Israël » n'est pas de la fête : il était déjà orphelin avant tout
-- ceci, et le défaire n'est pas l'affaire de cette migration.
delete from public.polity_wash
where name in ('Estado Novo','Moudjahidines','Nationalistes hongrois',
               'République batave napoléonienne','Serbes')
  and not exists (select 1 from public.polities p where p.name = polity_wash.name);

commit;

insert into public.polity_corrections (avant, apres, pourquoi, tranches)
values ('Antilles néerlandaises','Guyane néerlandaise',
        'Deux tranches du Suriname prises pour les Antilles — condition corrigée', 2);;
