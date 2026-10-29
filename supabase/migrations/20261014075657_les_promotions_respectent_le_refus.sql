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

  -- Son auteur s'y est peut-être soustrait : la case est cochée par défaut,
  -- et la décocher doit suffire. Vérifié ici et pas seulement dans la file,
  -- parce que c'est ici que la chose devient publique.
  if not source.shared then
    raise exception 'Son auteur ne l''ouvre pas à la bibliothèque.';
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

  if not source.shared then
    raise exception 'Son auteur ne l''ouvre pas à la bibliothèque.';
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
