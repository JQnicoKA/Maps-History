-- Les sauvegardes quittent l'API.
--
-- Six tables avaient été posées dans `public` le temps d'un chantier, et y
-- sont restées parce que les scripts `docs/defaire-*.sql` en ont besoin pour
-- revenir en arrière. Elles ne sont pas mortes — l'audit du 28 octobre 2026
-- les disait telles, à tort —, mais elles n'ont rien à faire dans le schéma
-- que PostgREST expose : `polity_widen_failed`, sans RLS, était lisible,
-- modifiable et vidable par n'importe qui avec la clé publique.
--
-- Elles déménagent dans `archive`, que l'API ne voit pas. Les scripts
-- d'annulation sont mis à jour dans le même commit.

create schema if not exists archive;
revoke all on schema archive from public, anon, authenticated;

alter table public.polity_widen_failed set schema archive;
alter table public.functions_before_dropping_handle set schema archive;
alter table public.polity_corrections set schema archive;
alter table public.polities_english_names set schema archive;
alter table public.polity_wash_english_names set schema archive;
alter table public.polity_french set schema archive;

-- Le schéma suffit à les fermer ; les droits hérités de `public` partent quand
-- même, pour qu'un retour de schéma par mégarde ne rouvre rien.
revoke all on all tables in schema archive from anon, authenticated;
alter table archive.polity_widen_failed enable row level security;

-- `widen_polities` écrivait dans `public.polity_widen_failed` : elle suit sa
-- table, et prend un `search_path` explicite (l'advisor le signalait).
-- PostGIS vit dans `public`, d'où ses `st_*` sans préfixe. Corps inchangé
-- pour le reste ; voir `docs/defaire-territoires-elargis.sql`.
drop function if exists public.widen_polities(integer, integer, double precision);

create function archive.widen_polities(
  seconds integer default 85,
  metres integer default 20000,
  grille double precision default 0.0000001
)
returns table(fait integer, rate integer, reste bigint)
language plpgsql
set search_path = public
as $function$
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
      insert into archive.polity_widen_failed (id, name, raison)
        values (r.id, r.name, sqlerrm)
        on conflict (id) do update set raison = excluded.raison;
      bad := bad + 1;
    end;
  end loop;
  return query select n, bad, count(*) from public.polities where geom_wide is null;
end;
$function$;

revoke all on function archive.widen_polities(integer, integer, double precision) from public, anon, authenticated;

-- Deux outils de renommage du fond de carte, appelables par `anon`. La RLS
-- bloquait déjà leurs écritures ; ils n'ont simplement rien à faire dans l'API.
revoke execute on function public.rename_polity(text, text) from public, anon, authenticated;
revoke execute on function public.fork_polity_wash(text, text) from public, anon, authenticated;
