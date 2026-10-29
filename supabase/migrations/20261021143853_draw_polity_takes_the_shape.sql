-- Le territoire arrive dessiné, et non plus en traits à épaissir.
--
-- La fonction recevait des traits et un rayon, et faisait elle-même le
-- tampon et l'union. C'était juste tant qu'on ne faisait qu'ajouter : une
-- liste de traits se réunit, elle ne se soustrait pas. La gomme — effacer en
-- coloriant — demande une différence de surfaces, donc une vraie forme ; et
-- qui dit vraie forme dit quelqu'un qui la calcule avant d'arriver ici.
--
-- C'est désormais le téléphone, en Mercator, dans l'espace même où l'écran
-- la dessine. Ce que la base y gagne : l'aperçu et le résultat cessent
-- d'être deux calculs qui se ressemblent. C'est le même polygone.
--
-- Elle garde tout ce qu'elle seule sait faire : réparer ce qui se croise,
-- mesurer l'aire sur l'ellipsoïde, poser l'ancre de l'étiquette, et choisir
-- un lavis qu'aucun voisin de la même époque ne porte déjà.
drop function if exists public.draw_polity(jsonb, double precision, text, integer, integer);

create or replace function public.draw_polity(
  shape jsonb,
  polity_name text,
  from_year integer,
  to_year integer
) returns uuid
language plpgsql
set search_path to ''
as $function$
declare
  peint public.geometry;
  choisi integer;
  nouveau uuid;
begin
  peint := public.ST_SetSRID(public.ST_GeomFromGeoJSON(shape::text), 4326);

  if peint is null or public.ST_IsEmpty(peint) then
    raise exception 'aucun tracé à enregistrer';
  end if;

  -- Réparer reste à sa charge : un polygone calculé en flottant peut se
  -- toucher lui-même sur un point, ce qu'aucun index ne pardonne.
  peint := public.ST_Multi(
             public.ST_CollectionExtract(public.ST_MakeValid(peint), 3)
           );

  if public.ST_IsEmpty(peint) then
    raise exception 'aucun tracé à enregistrer';
  end if;

  select coalesce(min(libre.n), 0) into choisi
  from generate_series(0, 8) as libre(n)
  where libre.n not in (
    select coalesce(w.wash, -1)
    from public.polities p
    left join public.polity_wash w on w.name = p.name
    where p.start_year <= to_year
      and p.end_year >= from_year
      and public.ST_DWithin(p.geom, peint, 0.5)
    union all
    select d.wash
    from public.drawn_polities d
    where d.user_id = auth.uid()
      and d.start_year <= to_year
      and d.end_year >= from_year
      and public.ST_DWithin(d.geom, peint, 0.5)
  );

  insert into public.drawn_polities
    (name, start_year, end_year, wash, anchor, area, geom)
  values (
    polity_name, from_year, to_year, choisi,
    public.ST_PointOnSurface(peint),
    public.ST_Area(peint::public.geography) / 1000000.0,
    peint
  )
  returning id into nouveau;

  return nouveau;
end;
$function$;;
