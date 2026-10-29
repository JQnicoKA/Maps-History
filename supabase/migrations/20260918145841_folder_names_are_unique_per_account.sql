-- The unique index on the name alone predates accounts. Left as it was, the
-- first reader to name a folder "Renaissance" would take that name away from
-- everyone else — and the refusal would tell them a stranger's folder exists.
-- Uniqueness belongs to the pair, and case-insensitively, which is how the app
-- has always compared them in the form.
alter table public.folders drop constraint if exists folders_name_key;

create unique index if not exists folders_owner_name_key
  on public.folders (user_id, lower(name));;
