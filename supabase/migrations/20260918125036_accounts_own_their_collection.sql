-- Everything a reader makes now belongs to an account: events, folders,
-- characters and trees carry an owner, and their child rows inherit it through
-- their parent. The collection made before accounts existed is handed to the
-- first account rather than dropped.

alter table public.events     add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.folders    add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.characters add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.trees      add column if not exists user_id uuid references auth.users(id) on delete cascade;

update public.events     set user_id = 'c91e5ef6-0c36-427d-a01c-66f5860a186c' where user_id is null;
update public.folders    set user_id = 'c91e5ef6-0c36-427d-a01c-66f5860a186c' where user_id is null;
update public.characters set user_id = 'c91e5ef6-0c36-427d-a01c-66f5860a186c' where user_id is null;
update public.trees      set user_id = 'c91e5ef6-0c36-427d-a01c-66f5860a186c' where user_id is null;

-- The default is what keeps the client honest without a line of app code: an
-- insert that forgets to say who it belongs to is stamped by the database.
alter table public.events     alter column user_id set not null, alter column user_id set default auth.uid();
alter table public.folders    alter column user_id set not null, alter column user_id set default auth.uid();
alter table public.characters alter column user_id set not null, alter column user_id set default auth.uid();
alter table public.trees      alter column user_id set not null, alter column user_id set default auth.uid();

create index if not exists events_user_idx     on public.events (user_id);
create index if not exists folders_user_idx    on public.folders (user_id);
create index if not exists characters_user_idx on public.characters (user_id);
create index if not exists trees_user_idx      on public.trees (user_id);;
