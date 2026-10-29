-- La couleur dominante d'une photographie, calculée une fois et rangée ici.
--
-- Deux colonnes et non une, parce qu'il y a deux faits à retenir : la couleur,
-- et le fait d'avoir regardé. Une photographie en noir et blanc n'a pas de
-- couleur dominante — `tint` reste nul — mais il ne faut pas la retélécharger
-- ni la redécoder à chaque démarrage pour réapprendre la même chose. C'est
-- `tinted_at` qui dit « on a regardé », et c'est sur lui que le filet filtre.
alter table public.character_photos
  add column tint text,
  add column tinted_at timestamptz;

alter table public.character_photos
  add constraint character_photos_tint_is_a_colour
  check (tint is null or tint ~ '^#[0-9a-f]{6}$');

-- Ce qui reste à regarder, et rien d'autre : le filet lit cet index à chaque
-- démarrage, et sur une collection déjà peinte il ne doit rien coûter.
create index character_photos_unpainted_idx
  on public.character_photos (character_id)
  where tinted_at is null;

-- Une copie porte les mêmes octets, donc la même couleur : la recalculer
-- donnerait le même résultat pour le prix d'un téléchargement.
create or replace function public.copy_one_character(source_id uuid, me uuid)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  source public.characters%rowtype;
  made uuid;
begin
  select * into source from public.characters c where c.id = source_id;
  if not found then
    return null;
  end if;

  select c.id into made
  from public.characters c
  where c.user_id = me
    and (c.origin_id = source.id or c.id = source.id)
  limit 1;
  if made is not null then
    return made;
  end if;

  insert into public.characters (
    user_id, name, bio,
    birth_year, birth_month, birth_day, birth_approx,
    death_year, death_month, death_day, death_approx,
    longitude, latitude, shared, origin_id
  ) values (
    me, source.name, source.bio,
    source.birth_year, source.birth_month, source.birth_day, source.birth_approx,
    source.death_year, source.death_month, source.death_day, source.death_approx,
    source.longitude, source.latitude, false, source.id
  ) returning id into made;

  insert into public.character_photos (
    character_id, storage_path, position, source, tint, tinted_at
  )
  select made, p.storage_path, p.position, p.source, p.tint, p.tinted_at
  from public.character_photos p where p.character_id = source.id;

  insert into public.copies (kind, source_id, user_id)
  values ('character', source.id, me) on conflict do nothing;

  return made;
end;
$function$;

-- L'arbre de quelqu'un d'autre se dessine avec le même `TreeFace` que le
-- sien : sans la teinte ici, le catalogue resterait monotone pendant que le
-- constructeur serait coloré, et les deux dessins divergeraient.
create or replace function public.shared_tree(wanted uuid)
 returns jsonb
 language sql
 stable security definer
 set search_path to ''
as $function$
  select jsonb_build_object(
    'id', t.id,
    'title', t.name,
    'type', 'tree',
    'note', (
      select case count(*)
        when 0 then 'vide'
        when 1 then '1 personnage'
        else count(*) || ' personnages · ' || count(distinct m.generation)
             || ' génération'
             || case when count(distinct m.generation) > 1 then 's' else '' end
      end
      from public.tree_members m
      join public.characters c on c.id = m.character_id
      where m.tree_id = t.id
    ),
    'description', t.note,
    'start_year', (
      select min(c.birth_year) from public.tree_members m
      join public.characters c on c.id = m.character_id where m.tree_id = t.id
    ),
    'start_month', null, 'start_day', null, 'start_approx', false,
    'end_year', (
      select max(coalesce(c.death_year, c.birth_year))
      from public.tree_members m
      join public.characters c on c.id = m.character_id where m.tree_id = t.id
    ),
    'end_month', null, 'end_day', null, 'end_approx', false,
    'longitude', null, 'latitude', null,
    'author', pr.handle,
    'stars', t.stars,
    'mine', t.user_id = auth.uid(),
    'copied', exists (
      select 1 from public.copies c
      where c.kind = 'tree' and c.source_id = t.id and c.user_id = auth.uid()
    ),
    'reported', exists (
      select 1 from public.reports r
      where r.kind = 'tree' and r.source_id = t.id and r.reporter = auth.uid()
    ),
    'photos', '[]'::jsonb,
    'cast', '[]'::jsonb,
    'folders', '[]'::jsonb,
    'held', '[]'::jsonb,
    'members', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id', m.id,
                 'character_id', m.character_id,
                 'generation', m.generation,
                 'position', m.position,
                 'importance', m.importance
               )
               order by m.generation, m.position
             )
      from (
        select * from public.tree_members mm
        where mm.tree_id = t.id
        order by mm.generation, mm.position
        limit 200
      ) m
    ), '[]'::jsonb),
    'links', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'from', l.parent_id, 'to', l.child_id, 'kind', l.kind
               )
             )
      from public.tree_links l where l.tree_id = t.id
    ), '[]'::jsonb),
    'people', coalesce((
      select jsonb_agg(distinct jsonb_build_object(
               'id', c.id,
               'name', c.name,
               'birth_year', c.birth_year, 'birth_month', c.birth_month,
               'birth_day', c.birth_day, 'birth_approx', c.birth_approx,
               'death_year', c.death_year, 'death_month', c.death_month,
               'death_day', c.death_day, 'death_approx', c.death_approx,
               'photo', (
                 select p.storage_path from public.character_photos p
                 where p.character_id = c.id order by p.position limit 1
               ),
               'tint', (
                 select p.tint from public.character_photos p
                 where p.character_id = c.id order by p.position limit 1
               )
             ))
      from public.tree_members m
      join public.characters c on c.id = m.character_id
      where m.tree_id = t.id
    ), '[]'::jsonb)
  )
  from public.trees t
  join public.profiles pr on pr.user_id = t.user_id
  where t.id = wanted
    and t.shared
    and not exists (
      select 1 from public.withheld w
      where w.kind = 'tree' and w.source_id = t.id
    )
    and not exists (
      select 1 from public.blocks b
      where (b.user_id = auth.uid() and b.blocked = t.user_id)
         or (b.user_id = t.user_id and b.blocked = auth.uid())
    );
$function$;;
