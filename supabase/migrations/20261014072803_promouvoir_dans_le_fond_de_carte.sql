-- Les villes et les territoires ne vont pas dans la bibliothèque : ils vont
-- dans la carte.
--
-- Ce sont les deux seuls genres qui possédaient déjà une place « vue par tout
-- le monde » — `places` et `polities`, le fond de référence que personne ne
-- modifie et que chacun peut masquer. Le geste du conservateur n'est donc pas
-- « publier une entrée qu'on vient copier » mais « promouvoir dans le fond ».
-- Pas de copie, pas de catalogue, pas d'étoiles, pas de ligne par lecteur :
-- une ligne, tout le monde l'a, et le masque qui existe déjà fait le reste.
--
-- Une ville promue se comporte **exactement** comme une ville
-- d'OpenHistoricalMap, masquage compris. Aucun concept neuf pour le lecteur.

alter table public.places add column curated boolean not null default false;
alter table public.polities add column curated boolean not null default false;

-- D'où elle vient, et sur quoi on s'est appuyé pour la croire. Jamais
-- affichée : c'est le carnet du conservateur. Une frontière fausse est sur la
-- carte de tout le monde, présentée comme un fait et indiscernable des
-- données d'OpenHistoricalMap — c'est là que repose l'autorité de
-- l'application, et dans un an on sera content de savoir d'où sortait cette
-- ligne-là.
alter table public.places add column provenance text;
alter table public.polities add column provenance text;

comment on column public.places.curated is
  'Ajoutée à la main, pas issue de l''extrait. Survit au rechargement : voir scripts/load-places.mjs, qui ne supprime que les ohm_id positifs.';
comment on column public.polities.curated is
  'Ajouté à la main. **scripts/build-polities.sql doit l''épargner** — son delete est sans condition par défaut.';

/**
 * Fait passer une ville du lecteur dans le fond de carte.
 *
 * L'`ohm_id` est **négatif**, et ce n'est pas un bricolage : `places.ohm_id`
 * est non nul et unique, le masque se fait sur lui, et le chargeur de
 * l'extrait ne supprime que les identifiants positifs — `/places?ohm_id=gt.0`.
 * Les négatifs étaient donc déjà réservés avant qu'on en ait eu besoin.
 *
 * Puis **la ligne de l'auteur est effacée**, comme décidé : sans cela il
 * verrait deux pastilles au même endroit, la sienne et celle du fond. Le
 * résultat visuel est identique — même nom, même point, mêmes années — donc
 * il ne perd rien et ne voit rien changer.
 */
create or replace function public.promote_place(
  which uuid,
  as_kind text default 'city',
  why text default null
) returns uuid
language plpgsql security definer
set search_path to ''
as $$
declare
  me uuid := auth.uid();
  source public.drawn_places%rowtype;
  made uuid;
  minted bigint;
begin
  if not exists (
    select 1 from public.profiles p where p.user_id = me and p.library
  ) then
    raise exception 'Seule la bibliothèque promeut.';
  end if;
  if as_kind not in ('city', 'town') then
    raise exception 'Un lieu est une ville ou un bourg.';
  end if;

  select * into source from public.drawn_places d where d.id = which;
  if not found then
    raise exception 'Cette ville n''existe pas.';
  end if;

  select coalesce(min(p.ohm_id), 0) - 1 into minted
  from public.places p where p.ohm_id < 0;

  insert into public.places (
    ohm_id, name, type, start_year, end_year, longitude, latitude,
    curated, provenance
  ) values (
    minted, source.name, as_kind, source.start_year, source.end_year,
    source.longitude, source.latitude, true, nullif(btrim(why), '')
  ) returning id into made;

  delete from public.drawn_places where id = which;
  return made;
end;
$$;

/**
 * Fait passer un territoire peint dans le fond de carte.
 *
 * Même geste, et la teinte se règle d'elle-même : `polities_by_ids` joint
 * `polity_wash` par la gauche, donc un territoire curé sans teinte attribuée
 * en ressort avec `wash: null`, et `washFor` retombe alors sur le hachage du
 * nom. Stable, et sans voisin à consulter.
 */
create or replace function public.promote_polity(
  which uuid,
  why text default null
) returns uuid
language plpgsql security definer
set search_path to ''
as $$
declare
  me uuid := auth.uid();
  source public.drawn_polities%rowtype;
  made uuid;
begin
  if not exists (
    select 1 from public.profiles p where p.user_id = me and p.library
  ) then
    raise exception 'Seule la bibliothèque promeut.';
  end if;

  select * into source from public.drawn_polities d where d.id = which;
  if not found then
    raise exception 'Ce territoire n''existe pas.';
  end if;

  insert into public.polities (
    name, start_year, end_year, area, anchor, geom, curated, provenance
  ) values (
    source.name, source.start_year, source.end_year, source.area,
    source.anchor, source.geom, true, nullif(btrim(why), '')
  ) returning id into made;

  delete from public.drawn_polities where id = which;
  return made;
end;
$$;

revoke execute on function public.promote_place(uuid, text, text) from public, anon;
revoke execute on function public.promote_polity(uuid, text) from public, anon;;
