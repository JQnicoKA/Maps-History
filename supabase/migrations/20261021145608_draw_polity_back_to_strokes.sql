-- Retour à la fonction qui reçoit les traits et les épaissit elle-même.
--
-- La version qui recevait la forme toute faite est abandonnée avec la gomme
-- qu'elle servait : voir `draw_polity_takes_the_shape`. Le téléphone
-- redevient ce qu'il était — il envoie le chemin du doigt et un rayon — et
-- c'est PostGIS qui fait le tampon, l'union et la réparation.
drop function if exists public.draw_polity(jsonb, text, integer, integer);

create or replace function public.draw_polity(
  strokes jsonb,
  brush_metres double precision,
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
  select public.ST_Union(
           public.ST_Buffer(
             public.ST_SetSRID(
               public.ST_MakeLine(
                 array(
                   select public.ST_MakePoint(
                            (point ->> 0)::double precision,
                            (point ->> 1)::double precision)
                   from jsonb_array_elements(stroke.value) as point
                 )
               ), 4326
             )::public.geography,
             greatest(brush_metres, 1)
           )::public.geometry
         )
    into peint
  from jsonb_array_elements(strokes) as stroke;

  if peint is null or public.ST_IsEmpty(peint) then
    raise exception 'aucun tracé à enregistrer';
  end if;

  peint := public.ST_Multi(
             public.ST_CollectionExtract(public.ST_MakeValid(peint), 3)
           );

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
