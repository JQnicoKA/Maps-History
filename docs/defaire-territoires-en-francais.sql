-- Défaire « les territoires parlent français »
-- ============================================
--
-- À coller dans l'éditeur SQL de Supabase. Aucun code n'est à restaurer :
-- la traduction n'a touché que des données.
--
-- **Deux chemins, et depuis les corrections seul le second est complet.**
-- Le dictionnaire `polity_french` tient les 1 541 couples anglais/français,
-- mais 78 noms ont été corrigés depuis — « Comté de Brabant » est devenu
-- « Duché de Brabant », « Grands Yuan » est devenu « Dayuan (Ferghana) », la
-- Serbie a été découpée en trois. Le dictionnaire ne les retrouve plus par
-- leur nom français.
--
-- `polities_english_names` restitue par **identifiant** et se moque donc de
-- tous les renommages : c'est le chemin qui remet l'état d'avant à coup sûr.
-- Voir `docs/territoires-a-corriger.md` pour ce qui a été corrigé, et la table
-- `polity_corrections` pour le journal.
--
-- Ce que la traduction avait fait :
--   1. `polity_wash.name`, dont le nom est la clé primaire — c'est elle qui
--      donne sa couleur à chaque territoire ;
--   2. `polities.name`, les 12 040 tranches du fond de carte ;
--   3. `hidden_polities.name`, ce que le lecteur a retiré de sa carte.
--
-- `drawn_polities` n'a jamais été touchée : ces noms-là sont ceux que les
-- lecteurs ont écrits eux-mêmes.

begin;

-- La clé primaire des lavis est déposée le temps de la bascule : une
-- contrainte d'unicité non différée se vérifie ligne par ligne, et il suffit
-- qu'un nom anglais croise en chemin un nom encore français pour que tout
-- échoue.
alter table public.polity_wash drop constraint polity_wash_pkey;

update public.polity_wash w
set name = f.en
from archive.polity_french f
where f.fr = w.name;

alter table public.polity_wash add primary key (name);

update public.polities p
set name = f.en
from archive.polity_french f
where f.fr = p.name;

update public.hidden_polities h
set name = f.en
from archive.polity_french f
where f.fr = h.name;

commit;

-- ---------------------------------------------------------------------------
-- Le second chemin : depuis les sauvegardes, qui portent l'état exact d'avant.
-- À n'exécuter que si le dictionnaire a été modifié et que le bloc ci-dessus
-- a laissé des noms français derrière lui.
-- ---------------------------------------------------------------------------
--
-- begin;
-- alter table public.polity_wash drop constraint polity_wash_pkey;
-- delete from public.polity_wash;
-- insert into public.polity_wash (name, wash)
--   select name, wash from archive.polity_wash_english_names;
-- alter table public.polity_wash add primary key (name);
--
-- update public.polities p
-- set name = b.name
-- from archive.polities_english_names b
-- where b.id = p.id;
-- commit;

-- ---------------------------------------------------------------------------
-- Une fois la traduction adoptée pour de bon, ces trois tables ne servent
-- plus à rien et pèsent environ un mégaoctet :
--
--   drop table archive.polities_english_names;
--   drop table archive.polity_wash_english_names;
--   drop table archive.polity_french;
--
-- Garder au moins `polity_french` tant qu'un nouveau chargement du fond de
-- carte reste envisageable : `scripts/load-cliopatria.mjs` réécrirait les
-- noms en anglais, et ce dictionnaire est ce qui permettrait de retraduire
-- sans tout refaire à la main.
