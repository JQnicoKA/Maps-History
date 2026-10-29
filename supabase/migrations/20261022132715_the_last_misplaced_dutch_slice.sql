-- Trois cent trente-quatre kilomètres carrés à 18° nord, emportés avec la
-- Guyane par un découpage sur la seule longitude.
--
-- Mon tri des colonies néerlandaises d'Amérique séparait New York du reste par
-- le 65e méridien. Saint-Eustache et Saint-Martin sont à 63° ouest — du bon
-- côté du méridien, et à douze degrés de latitude de la Guyane. La longitude
-- ne suffisait pas : ces îles-là sont les Antilles.
begin;

update public.polities set name = 'Antilles néerlandaises'
where name = 'Guyane néerlandaise' and st_y(anchor) > 10;

commit;

insert into public.polity_corrections (avant, apres, pourquoi, tranches)
values ('Guyane néerlandaise','Antilles néerlandaises',
        'Les îles Sous-le-Vent emportées par un découpage sur la seule longitude', 1);

select name, count(*) as tranches, min(start_year) as de, max(end_year) as a,
       round((max(st_y(anchor)) - min(st_y(anchor)))::numeric) as ecart_lat
from polities where name in ('Guyane néerlandaise','Antilles néerlandaises')
group by name order by name;;
