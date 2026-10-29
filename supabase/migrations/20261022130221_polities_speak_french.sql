-- La traduction, appliquée.
--
-- Trois tables portent ces noms et doivent changer ensemble :
--
--   * `polities`, les 12 040 tranches du fond de carte ;
--   * `polity_wash`, qui donne sa couleur à chaque nom — **et dont le nom est
--     la clé primaire**. Laissée en anglais, chaque territoire aurait perdu
--     son lavis et serait retombé sur la couleur tirée de son nom par
--     `washFor`, c'est-à-dire que toute la carte aurait changé de palette ;
--   * `hidden_polities`, où le lecteur range ce qu'il ne veut plus voir. Vide
--     aujourd'hui, reprise quand même : une table vide se remplit.
--
-- La clé primaire des lavis est **déposée le temps de la mise à jour**. Une
-- contrainte d'unicité non différée se vérifie ligne par ligne, et il suffit
-- qu'un nom français croise en chemin un nom encore anglais pour que la
-- transaction entière échoue. Aucun croisement n'a été trouvé — c'est vérifié
-- avant —, mais la vérification porte sur l'état d'aujourd'hui et la
-- précaution ne coûte rien.
--
-- Les territoires **dessinés par les lecteurs** ne sont pas touchés :
-- `drawn_polities` porte les noms qu'ils ont écrits eux-mêmes.
begin;

alter table public.polity_wash drop constraint polity_wash_pkey;

update public.polity_wash w
set name = f.fr
from public.polity_french f
where f.en = w.name;

alter table public.polity_wash add primary key (name);

update public.polities p
set name = f.fr
from public.polity_french f
where f.en = p.name;

update public.hidden_polities h
set name = f.fr
from public.polity_french f
where f.en = h.name;

commit;;
