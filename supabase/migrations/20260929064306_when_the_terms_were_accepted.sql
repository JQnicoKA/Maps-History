-- When this account agreed to the terms, and to which version of them.
--
-- Recorded rather than assumed. The box at sign-up is the moment it happens,
-- but a box is a fact about a screen; this is a fact about an account, and it
-- is the one that survives a rewritten screen. The version is a date so that
-- terms revised later can be told apart from terms accepted before.
alter table public.profiles
  add column terms_at timestamptz,
  add column terms_version date;

comment on column public.profiles.terms_at is
  'When this account accepted the terms of use. Null for accounts made before there were any.';;
