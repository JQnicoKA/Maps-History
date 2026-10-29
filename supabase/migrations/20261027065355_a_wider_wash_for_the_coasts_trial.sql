-- Des territoires élargis jusqu'à la côte — à l'essai, sur l'an 1521.
--
-- Cliopatria est numérisé à un point tous les 25 km, donc ses côtes suivent
-- les vraies de loin : par endroits le lavis déborde dans la mer, par d'autres
-- il s'arrête avant le rivage et laisse un liséré de terre nue. Le débordement
-- ne coûte rien — `territory-fill` est posé `beforeId="water"`, donc la mer
-- opaque du fond de carte repasse par-dessus. Le manque, lui, se voit.
--
-- Élargir convertit donc le manque en débordement, et le débordement est
-- gratuit. La formule :
--
--     large(T) = T ∪ ( tampon(T, 10 km) \ MASQUE )
--
-- Trois choses à y remarquer :
--
--   1. **`T ∪`**, donc on ajoute et on ne rogne jamais. Sans lui, retrancher
--      le masque mangeait aussi les chevauchements que Cliopatria porte déjà
--      — l'aire baissait de 2,3 % au lieu de monter.
--   2. **Le masque est toute terre jamais revendiquée**, et non les seuls
--      voisins contemporains. Avec les contemporains, une frontière ouverte
--      sur une marche sans maître gagnait 10 km de terre ferme ; or 10 km font
--      370 pixels au zoom 11. Le masque le réduit à la terre que personne n'a
--      réclamée en 5 400 ans : la mer, et le désert vrai.
--   3. **Le tampon est posé en Mercator**, avec la correction de latitude du
--      centre du territoire (`10 km / cos φ`), parce qu'un tampon géographique
--      sur 12 040 multipolygones ne tient pas dans le temps imparti.
--
-- Le masque fait 31 961 sommets pour toute la terre habitée, contre 2,47
-- millions dans la source : l'union fait fondre les revendications
-- superposées, et c'est tout l'intérêt de le calculer une fois.
--
-- `geom` reste intact. La fonction préfère `geom_wide` quand elle existe, donc
-- seul 1521 change et le retour en arrière est une colonne à vider.
alter table public.polities
  add column if not exists geom_wide geometry(MultiPolygon, 4326);

comment on column public.polities.geom_wide is
  'Le même territoire, élargi de 10 km là où personne n''a jamais rien tracé — c''est-à-dire vers la mer. Null tant que le calcul n''a pas été fait : la fonction retombe alors sur `geom`.';

update public.polities p
set geom_wide = st_multi(st_simplifypreservetopology(e.large, 0.03))
from public.essai_1521 e
where e.id = p.id;

create or replace function public.polities_by_ids(ids uuid[])
returns jsonb
language sql
stable
set search_path to ''
as $function$
  select jsonb_build_object(
    'type', 'FeatureCollection',
    'features', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'type', 'Feature',
          'properties', jsonb_build_object(
            'id', p.id,
            'name', p.name,
            'level', 2,
            'standalone', true,
            'area', p.area,
            'wikidata', p.wikidata,
            'wash', w.wash,
            'from', p.start_year,
            'to', p.end_year,
            'anchor', jsonb_build_array(
              round(public.st_x(p.anchor)::numeric, 5),
              round(public.st_y(p.anchor)::numeric, 5)
            )
          ),
          -- Le lavis élargi quand il a été calculé, le tracé d'origine sinon.
          -- Un `coalesce` et non deux fonctions : la bascule et son retour
          -- sont le remplissage ou le vidage d'une colonne.
          'geometry', public.ST_AsGeoJSON(coalesce(p.geom_wide, p.geom))::jsonb
        )
      ),
      '[]'::jsonb
    )
  )
  from public.polities p
  left join public.polity_wash w on w.name = p.name
  where p.id = any(ids);
$function$;;
