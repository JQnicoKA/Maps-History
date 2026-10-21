-- Défaire « les territoires dessinés deviennent modifiables »
-- ===========================================================
--
-- À coller dans l'éditeur SQL de Supabase pour revenir exactement à l'état
-- d'avant. À faire **avant** de restaurer le code, ou en même temps : la
-- version précédente de l'application appelle `draw_polity` avec cinq
-- arguments, et la nouvelle en attend d'autres.
--
-- Ce que la migration `drawn_polities_keep_their_strokes` avait fait :
--   1. ajouté la colonne `drawn_polities.strokes`, qui garde le tracé ;
--   2. remplacé `draw_polity` par une version qui épaissit chaque trait à sa
--      propre largeur, range le tracé, et sait mettre à jour un territoire
--      existant au lieu d'en créer un ;
--   3. ajouté `editable` au retour de `my_territories`, et la fonction
--      `territory_strokes` qui rend le tracé d'un seul territoire.
--
-- Ce script défait les deux. **Il perd les tracés enregistrés depuis**, donc
-- les territoires dessinés entre-temps cesseront d'être modifiables — leur
-- polygone, lui, est intact et ne bouge pas d'un pouce.

begin;

drop function if exists public.draw_polity(jsonb, text, integer, integer, uuid);
drop function if exists public.territory_strokes(uuid);

-- `my_territories` sans la colonne `editable`, qui disait si un territoire
-- avait gardé son tracé. Le type de retour change, donc il faut la déposer
-- avant de la refaire — Postgres refuse de modifier celui d'une fonction.
drop function if exists public.my_territories();

create function public.my_territories()
returns table (
  id uuid,
  name text,
  start_year integer,
  end_year integer,
  area double precision,
  shape jsonb,
  shared boolean
)
language sql
stable
set search_path to ''
as $my_territories$
  select
    d.id, d.name, d.start_year, d.end_year, d.area,
    public.ST_AsGeoJSON(
      public.ST_SimplifyPreserveTopology(d.geom, 0.1), 2
    )::jsonb,
    d.shared
  from public.drawn_polities d
  order by d.start_year;
$my_territories$;

alter table public.drawn_polities drop column if exists strokes;

-- La fonction telle qu'elle était : des traits nus, un rayon pour tous.
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
$function$;

commit;
