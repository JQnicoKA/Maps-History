-- An empty search_path, and every name written out: a function that resolves
-- its own tables through whatever schema the caller happens to have set is a
-- way in. Flagged by the database linter, and it costs one line.
create or replace function public.tree_member_one_generation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.tree_members other
    where other.tree_id = new.tree_id
      and other.character_id = new.character_id
      and other.generation <> new.generation
      and other.id <> new.id
  ) then
    raise exception
      'ce personnage est déjà placé dans une autre génération de cet arbre';
  end if;
  return new;
end;
$$;;
