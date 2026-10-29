-- Leaving has to be possible from inside the app: the App Store requires it of
-- anything that lets you sign up, and it is the plainest reading of the right
-- to erasure. No role a phone can hold may touch `auth.users`, so the deed is
-- done by a function that runs as its owner — and the only row it will ever
-- delete is the caller's own, because `auth.uid()` is the only identity it
-- consults. Everything the account owns follows through `on delete cascade`.
--
-- Pictures are not rows and do not cascade: the app empties the bucket of its
-- own files before calling this. See `deleteAccount` in features/auth.
create or replace function public.delete_own_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;;
