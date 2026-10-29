-- A character may now stand several times on one row — a man with three wives
-- is drawn three times, once beside each — but never on two different rows,
-- which would put the same person in two generations of one family.
alter table public.tree_members
  drop constraint if exists tree_members_tree_id_character_id_key;

create or replace function public.tree_member_one_generation()
returns trigger
language plpgsql
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
$$;

drop trigger if exists tree_member_one_generation on public.tree_members;
create trigger tree_member_one_generation
  before insert or update of generation, character_id on public.tree_members
  for each row execute function public.tree_member_one_generation();;
