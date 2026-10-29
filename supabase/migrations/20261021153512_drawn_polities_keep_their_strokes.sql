-- Un territoire dessiné garde son tracé, et redevient modifiable.
--
-- Le polygone reste ce qu'il a toujours été : **dérivé**. Ce qui change est
-- qu'on garde ce dont il dérive. Épaissir une ligne n'a pas d'inverse, donc
-- sans le tracé il n'y a aucun moyen de reprendre un dessin — on ne peut que
-- le refaire.
--
-- Le tracé est un tableau de coups de pinceau :
--   [{"points": [[lon, lat], …], "metres": 5000}, …]
--
-- **Chaque coup porte sa propre largeur**, et c'est une correction autant
-- qu'une nécessité. La version précédente prenait un rayon unique, celui du
-- zoom au moment d'appuyer sur « Terminer » : peindre une côte de près puis
-- s'éloigner avant de terminer donnait un territoire jusqu'à seize fois plus
-- épais que ce qu'on avait vu. Personne ne l'avait remarqué parce qu'une
-- session dure une minute ; rouvrir un dessin l'aurait rendu criant.
--
-- Pour défaire : docs/defaire-territoires-modifiables.sql
comment on table public.drawn_polities is null;

alter table public.drawn_polities
  add column if not exists strokes jsonb;

comment on column public.drawn_polities.strokes is
  'Le tracé dont le polygone dérive : [{points, metres}]. Null pour les territoires dessinés avant que cette colonne existe, qui ne sont donc pas modifiables.';

drop function if exists public.draw_polity(jsonb, double precision, text, integer, integer);

create or replace function public.draw_polity(
  strokes jsonb,
  polity_name text,
  from_year integer,
  to_year integer,
  existing uuid default null
) returns uuid
language plpgsql
set search_path to ''
as $function$
declare
  peint public.geometry;
  choisi integer;
  nouveau uuid;
begin
  -- Chaque coup épaissi à sa propre largeur, puis tout réuni.
  select public.ST_Union(
           public.ST_Buffer(
             public.ST_SetSRID(
               public.ST_MakeLine(
                 array(
                   select public.ST_MakePoint(
                            (point ->> 0)::double precision,
                            (point ->> 1)::double precision)
                   from jsonb_array_elements(stroke.value -> 'points') as point
                 )
               ), 4326
             )::public.geography,
             greatest((stroke.value ->> 'metres')::double precision, 1)
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

  if public.ST_IsEmpty(peint) then
    raise exception 'aucun tracé à enregistrer';
  end if;

  -- Un lavis qu'aucun voisin de la même époque ne porte déjà. En reprenant
  -- un territoire, on s'ignore soi-même : sans quoi il refuserait sa propre
  -- couleur et en changerait à chaque passage.
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
      and (existing is null or d.id <> existing)
  );

  if existing is null then
    insert into public.drawn_polities
      (name, start_year, end_year, wash, anchor, area, geom, strokes)
    values (
      polity_name, from_year, to_year, choisi,
      public.ST_PointOnSurface(peint),
      public.ST_Area(peint::public.geography) / 1000000.0,
      peint, strokes
    )
    returning id into nouveau;
    return nouveau;
  end if;

  -- La clause sur `user_id` n'est pas une politesse : cette fonction est
  -- `security definer`, donc elle passe outre la sécurité par ligne. Sans
  -- elle, un identifiant deviné laisserait réécrire le territoire d'autrui.
  update public.drawn_polities
     set name = polity_name,
         start_year = from_year,
         end_year = to_year,
         wash = choisi,
         anchor = public.ST_PointOnSurface(peint),
         area = public.ST_Area(peint::public.geography) / 1000000.0,
         geom = peint,
         strokes = draw_polity.strokes
   where id = existing
     and user_id = auth.uid()
  returning id into nouveau;

  if nouveau is null then
    raise exception 'territoire introuvable';
  end if;

  return nouveau;
end;
$function$;;
