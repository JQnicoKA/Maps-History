-- The accounts that existed before there were names.
--
-- One at a time rather than one statement: `invent_handle` checks the table
-- as it draws, and rows inserted by the same statement are not there to be
-- seen — two accounts could be handed the same name.
do $$
declare
  waiting uuid;
begin
  for waiting in
    select u.id
    from auth.users u
    where not exists (
      select 1 from public.profiles p where p.user_id = u.id
    )
  loop
    insert into public.profiles (user_id, handle)
    values (waiting, public.invent_handle());
  end loop;
end;
$$;;
