-- Une étiquette : quelques mots posés dans une case de l'arbre, large de une
-- à trois colonnes. Même table que les personnages, et c'est tout l'intérêt —
-- elle se déplace, se fait pousser et se recopie par la machinerie qui existe.

alter table public.tree_members
  alter column character_id drop not null,
  add column text text,
  add column width smallint not null default 1;

-- L'un ou l'autre, jamais les deux ni aucun : c'est cette contrainte que le
-- client lit pour savoir de quelle nature est une ligne.
alter table public.tree_members
  add constraint un_membre_est_une_personne_ou_un_ecrit
  check (
    (character_id is not null and text is null)
    or (character_id is null and text is not null)
  );

alter table public.tree_members
  add constraint une_etiquette_tient_une_a_trois_colonnes
  check (width between 1 and 3 and (character_id is null or width = 1));

-- La règle exigeait de posséder le personnage. Une étiquette n'en a pas : ce
-- qu'elle exige, c'est de posséder l'arbre, et la première moitié le dit déjà.
drop policy "own tree members" on public.tree_members;

create policy "own tree members" on public.tree_members
  for all to authenticated
  using (
    exists (
      select 1 from public.trees t
      where t.id = tree_members.tree_id and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.trees t
      where t.id = tree_members.tree_id and t.user_id = auth.uid()
    )
    and (
      character_id is null
      or exists (
        select 1 from public.characters c
        where c.id = tree_members.character_id and c.user_id = auth.uid()
      )
    )
  );

-- Aucun lien ne touche une étiquette, et c'est une règle plutôt qu'un oubli
-- d'interface : un trait tiré d'un titre vers quelqu'un serait une
-- affirmation de filiation que personne n'a faite. Une CHECK ne peut pas
-- regarder une autre ligne, donc c'est un déclencheur.
create or replace function public.tree_link_joins_people()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
  if exists (
    select 1 from public.tree_members m
    where m.id in (new.parent_id, new.child_id)
      and m.character_id is null
  ) then
    raise exception 'une étiquette ne porte pas de lien';
  end if;
  return new;
end;
$function$;

create trigger tree_link_joins_people
  before insert or update on public.tree_links
  for each row execute function public.tree_link_joins_people();

-- La porte de partage doit porter les étiquettes, sinon un arbre partagé les
-- perd et celui qui le copie reçoit un arbre amputé. Le compte « 9 personnages »
-- n'a pas besoin d'être touché : il joint `characters`, donc il les ignore déjà.
do $patch$
declare
  src text;
  ancien text := $a$                 'id', m.id,
                 'character_id', m.character_id,
                 'generation', m.generation,
                 'position', m.position,
                 'importance', m.importance$a$;
  neuf text := $n$                 'id', m.id,
                 'character_id', m.character_id,
                 'text', m.text,
                 'width', m.width,
                 'generation', m.generation,
                 'position', m.position,
                 'importance', m.importance$n$;
begin
  select pg_get_functiondef(p.oid) into src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'shared_tree';
  if src is null or position(ancien in src) = 0 then
    raise exception 'le bloc members de shared_tree ne correspond plus';
  end if;
  execute replace(src, ancien, neuf);
end $patch$;

-- Et la copie : sans ça `copy_one_character(null)` rend null et la boucle
-- passe son tour, ce qui perdrait l'étiquette en silence.
do $patch$
declare
  src text;
  ancien text := $a$    theirs := public.copy_one_character(member.character_id, me);
    if theirs is null then
      continue;
    end if;
    insert into public.tree_members (
      tree_id, character_id, generation, position, importance, note
    ) values (
      made, theirs, member.generation, member.position, member.importance,
      member.note
    ) returning id into mine_now;$a$;
  neuf text := $n$    if member.character_id is null then
      insert into public.tree_members (
        tree_id, text, width, generation, position
      ) values (
        made, member.text, member.width, member.generation, member.position
      ) returning id into mine_now;
    else
      theirs := public.copy_one_character(member.character_id, me);
      if theirs is null then
        continue;
      end if;
      insert into public.tree_members (
        tree_id, character_id, generation, position, importance, note
      ) values (
        made, theirs, member.generation, member.position, member.importance,
        member.note
      ) returning id into mine_now;
    end if;$n$;
begin
  select pg_get_functiondef(p.oid) into src
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'copy_tree';
  if src is null or position(ancien in src) = 0 then
    raise exception 'la boucle de copy_tree ne correspond plus';
  end if;
  execute replace(src, ancien, neuf);
end $patch$;;
