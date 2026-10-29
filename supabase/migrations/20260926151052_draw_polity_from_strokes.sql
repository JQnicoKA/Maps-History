-- Transforme des coups de pinceau en territoire.
--
-- L'application n'envoie que ce qu'elle sait : les tracés, chacun une suite de
-- points, et la largeur du pinceau en mètres. PostGIS fait le reste — épaissir
-- chaque trait, réunir le tout, valider. Aucune géométrie n'est calculée sur
-- le téléphone, qui n'a pas de bibliothèque pour ça et n'en a pas besoin.
--
-- La couleur est choisie ici aussi : parmi les neuf lavis, le premier qu'aucun
-- territoire contemporain et voisin n'utilise déjà. C'est la version locale de
-- la coloration de graphe qui a produit les couleurs de la référence.
--
-- `search_path` est vide, donc jusqu'aux noms de types sont qualifiés : sans
-- cela, `geometry` seul ne se résout pas.
create or replace function public.draw_polity(
  strokes jsonb,        -- [[[lng,lat],[lng,lat],…], …]
  brush_metres double precision,
  polity_name text,
  from_year integer,
  to_year integer
)
returns uuid
language plpgsql
security invoker
set search_path to ''
as $$
declare
  peint public.geometry;
  choisi integer;
  nouveau uuid;
begin
  -- Chaque tracé devient une ligne, épaissie du rayon du pinceau. Un tracé
  -- d'un seul point donnerait une ligne dégénérée : `ST_Buffer` en fait un
  -- disque, ce qui est exactement ce qu'on veut d'une simple tape.
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
             )::geography,
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

  -- Le premier lavis qu'aucun voisin contemporain ne porte déjà. Voisin au
  -- sens large : ce qui passe à moins d'un demi-degré, afin que deux pays
  -- proches sans se toucher restent distinguables.
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
    public.ST_Area(peint::geography) / 1000000.0,
    peint
  )
  returning id into nouveau;

  return nouveau;
end;
$$;

revoke all on function public.draw_polity(jsonb, double precision, text, integer, integer) from public, anon;
grant execute on function public.draw_polity(jsonb, double precision, text, integer, integer) to authenticated;;
