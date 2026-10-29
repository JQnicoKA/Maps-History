-- Les 12 040 territoires élargis, et la recette consignée.
--
-- La migration `a_wider_wash_for_the_coasts_trial` a posé la colonne et le
-- `coalesce` de `polities_by_ids` ; celle-ci garde la fonction qui a rempli la
-- colonne, pour qu'elle soit relisible et rejouable à une autre distance.
--
-- Résultat sur les 12 040 : **+7,7 % d'aire**, sommets ×2,48 (2,47 M → 6,13 M),
-- **zéro géométrie invalide, zéro tache flottante** sur 44 564 morceaux. La
-- date la plus lourde des cinq mille ans, l'an 2000, passe de 795 ko à 1,79 Mo
-- de GeoJSON — répartis sur deux requêtes de 120 entités.
--
-- Ce que quatre essais ont appris, et que le code seul ne dirait pas :
--
--   1. **`T ∪`**, donc on ajoute et on ne rogne jamais. Sans lui, la
--      soustraction mangeait les chevauchements que Cliopatria porte déjà, et
--      l'aire *baissait* de 2,3 % au lieu de monter.
--
--   2. **Les contemporains, et eux seuls.** Un essai retranchait « toute terre
--      jamais revendiquée », pour empêcher une frontière ouverte de gagner
--      20 km de terre ferme. C'était se mordre la queue : sur la côte
--      languedocienne, 3 territoires sont dessinés en 1521 mais 529 y ont été
--      tracés toutes époques confondues. Le masque protégeait donc les côtes
--      nues qu'il s'agissait de remplir, l'anneau était coupé sur ces bandes
--      invisibles et ressurgissait au-delà, en mer : frontière, blanc, puis
--      tache flottante — 54 des 119 territoires de 1521 en portaient.
--      Cliopatria découpant ses territoires aux dates de changement (la
--      tranche de France est 1521–1525), « chevaucher la tranche » équivaut à
--      « être dessiné ». Chaque coupure tombe sur une couleur, et une coupure
--      contre une couleur ne laisse pas de trou.
--
--   3. **`st_makevalid` à l'intérieur de la différence**, et le tampon borné
--      au voisinage du territoire. Les Fidji vont jusqu'à 179,86° et vingt
--      kilomètres en valent 0,188 : le tampon franchit l'antiméridien,
--      `st_transform` rend des longitudes au-delà de 180, et `st_makevalid`
--      les replie en ruban parasite à l'autre bout de la carte. Un
--      multipolygone ainsi cassé empoisonne le tout — c'est pour sa
--      Tchoukotka que l'Empire russe échouait en mer Blanche. 175 territoires
--      butaient là-dessus ; la borne les a tous sauvés.
--
--   4. **Le tri des morceaux est refait après la simplification** : à trois
--      kilomètres de tolérance elle sectionne un isthme d'un point de large,
--      et le morceau détaché reparaît en tache.
--
-- Pour reprendre à une autre distance, voir `docs/defaire-territoires-elargis.sql`.
create or replace function public.widen_polities(
  seconds int default 85,
  metres int default 20000,
  grille float8 default 0.0000001
)
returns table(fait int, rate int, reste bigint)
language plpgsql
as $$
declare
  deadline timestamptz := clock_timestamp() + make_interval(secs => seconds);
  r record;
  n int := 0;
  bad int := 0;
begin
  for r in select id, name from public.polities where geom_wide is null order by id loop
    exit when clock_timestamp() > deadline;
    begin
      update public.polities p
      set geom_wide = w.g
      from (
        select st_multi(st_collectionextract(st_makevalid(
                 st_union(q.geom, coalesce(b.ajout, st_setsrid('POLYGON EMPTY'::geometry, 4326)))
               ), 3)) as g
        from public.polities q
        -- Combien de degrés de longitude vaut le tampon, à cette latitude.
        cross join lateral (
          select metres / (111320.0 * cos(radians(
                   least(abs(st_y(st_centroid(q.geom))), 80.0)))) * 1.6 as marge
        ) m
        -- L'anneau : le tampon posé en Mercator avec la correction de
        -- latitude, validé, borné au voisinage, puis le territoire ôté.
        cross join lateral (
          select st_difference(
            st_intersection(
              st_makevalid(st_transform(
                st_buffer(
                  st_transform(q.geom, 3857),
                  metres / cos(radians(least(abs(st_y(st_centroid(q.geom))), 80.0))),
                  'quad_segs=1'
                ), 4326)),
              st_intersection(
                st_expand(q.geom, m.marge),
                st_makeenvelope(-180, -89.9, 180, 89.9, 4326)
              )
            ),
            q.geom, grille) as anneau
        ) a
        -- Moins les seuls contemporains, et l'on ne garde que les morceaux
        -- qui touchent le tracé d'origine.
        cross join lateral (
          select st_union(d.geom) as garde
          from st_dump(st_difference(
            a.anneau,
            coalesce((
              select st_makevalid(st_union(o.geom)) from public.polities o
              where o.id <> q.id
                and o.start_year <= q.end_year and o.end_year >= q.start_year
                and o.geom && a.anneau and st_intersects(o.geom, a.anneau)
            ), st_setsrid('POLYGON EMPTY'::geometry, 4326)),
            grille
          )) d
          where st_intersects(d.geom, q.geom)
        ) k
        -- Simplifié, puis trié une seconde fois.
        cross join lateral (
          select st_union(d2.geom) as ajout
          from st_dump(st_simplifypreservetopology(
            coalesce(k.garde, st_setsrid('POLYGON EMPTY'::geometry, 4326)), 0.03)) d2
          where st_intersects(d2.geom, q.geom)
        ) b
        where q.id = r.id
      ) w
      where p.id = r.id;
      n := n + 1;
    exception when others then
      -- Le territoire garde son tracé d'origine et le lot continue. Une côte
      -- non élargie est l'état d'hier ; un lot interrompu ne laisse rien.
      update public.polities set geom_wide = st_multi(geom) where id = r.id;
      insert into public.polity_widen_failed (id, name, raison)
        values (r.id, r.name, sqlerrm)
        on conflict (id) do update set raison = excluded.raison;
      bad := bad + 1;
    end;
  end loop;
  return query select n, bad, count(*) from public.polities where geom_wide is null;
end;
$$;

revoke all on function public.widen_polities(int, int, float8) from public, anon, authenticated;

-- Les échafaudages. `polity_widen_failed` reste : la fonction y écrit, et elle
-- est désormais vide.
drop procedure if exists public.widen_polities_run(int, int, int, float8);
drop table if exists public.essai_1521;
drop table if exists public.essai_terre;
drop table if exists public.essai_sommets;;
