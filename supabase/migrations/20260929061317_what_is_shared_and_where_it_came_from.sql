-- Two columns on everything a reader can make.
--
-- `shared` is true by default, and that is the whole posture of the app: what
-- is written here is history, not a diary, and a chronicle nobody publishes
-- is a chronicle nobody reads. The escape hatch exists for the reader who is
-- writing their own family rather than the world's.
--
-- `origin_id` remembers which row a copy was taken from. Nothing reads it
-- yet. It costs one column now and cannot be recovered later: without it, a
-- copy can never be told that its original has been corrected, and two copies
-- of the same source can never be recognised as one.

alter table public.events
  add column shared boolean not null default true,
  add column origin_id uuid;

alter table public.folders
  add column shared boolean not null default true,
  add column origin_id uuid;

alter table public.characters
  add column shared boolean not null default true,
  add column origin_id uuid;

alter table public.trees
  add column shared boolean not null default true,
  add column origin_id uuid;

alter table public.drawn_polities
  add column shared boolean not null default true,
  add column origin_id uuid;

-- How a copy asks "have I already taken this one?", which is what stops the
-- same character arriving twice behind two different events.
create index events_origin_idx on public.events (user_id, origin_id)
  where origin_id is not null;
create index folders_origin_idx on public.folders (user_id, origin_id)
  where origin_id is not null;
create index characters_origin_idx on public.characters (user_id, origin_id)
  where origin_id is not null;
create index trees_origin_idx on public.trees (user_id, origin_id)
  where origin_id is not null;
create index drawn_polities_origin_idx on public.drawn_polities (user_id, origin_id)
  where origin_id is not null;

comment on column public.events.shared is
  'Visible in the community catalogue. True by default; a copy is made false.';
comment on column public.events.origin_id is
  'The row this was copied from, in another account. Null for an original.';;
