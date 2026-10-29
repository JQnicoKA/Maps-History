-- La création du profil, réécrite à la main.
--
-- **Le remplacement textuel a échoué ici, et il fallait le voir.** La fonction
-- tentait cinq fois d'insérer un pseudonyme tiré au sort, puis retombait sur
-- un nom déterministe. Mon remplacement a retiré la colonne `handle` des deux
-- `insert` mais n'a su enlever la valeur que du premier : le second se
-- retrouvait avec une colonne et deux valeurs, et aurait échoué à la première
-- inscription qui serait allée jusque-là.
--
-- Sans pseudonyme, toute cette mécanique n'a plus d'objet : il n'y a plus de
-- collision possible, donc plus de tentatives à compter ni de repli à prévoir.
-- Une ligne suffit.
--
-- La fonction change de nom au passage : `give_a_handle` ne donnait plus de
-- pseudonyme, et un nom qui ment est pire qu'un nom long.
create or replace function public.give_a_profile()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  insert into public.profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists give_a_handle_on_sign_up on auth.users;

create trigger give_a_profile_on_sign_up
  after insert on auth.users
  for each row execute function public.give_a_profile();

drop function if exists public.give_a_handle();
drop function if exists public.invent_handle();

-- La liste des comptes bloqués, qui n'avait que le pseudonyme pour les
-- nommer. Elle rend désormais leur identifiant — ce qui désigne vraiment un
-- compte, et ce dont la modération a besoin. Aucun écran ne l'appelle.
drop function if exists public.blocked_people();

create function public.blocked_people()
returns table (id uuid)
language sql
stable
security definer
set search_path to ''
as $$
  select b.blocked
  from public.blocks b
  where b.user_id = auth.uid()
  order by b.blocked;
$$;

grant execute on function public.blocked_people() to authenticated;;
