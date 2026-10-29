-- The name an account wears in front of the others.
--
-- Nothing else lives here, and that is the point: this is the one table in
-- the schema every signed-in reader may read, so it must hold nothing an
-- account would mind being read. An address never touches it.
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  handle text not null,
  created_at timestamptz not null default now()
);

-- Case-insensitively unique: "Cartographe-1487" and "cartographe-1487" are
-- the same name to a reader, so they must be the same name to the database.
create unique index profiles_handle_unique on public.profiles (lower(handle));

alter table public.profiles
  add constraint profiles_handle_shape check (
    length(handle) between 3 and 24
    and handle = btrim(handle)
    -- Letters, digits, and the three marks a name may carry. No leading
    -- punctuation, so nobody can sort themselves to the top of a list.
    and handle ~ '^[A-Za-zÀ-ÖØ-öø-ÿ0-9][A-Za-zÀ-ÖØ-öø-ÿ0-9 ''-]*$'
  );

/**
 * A name nobody had to think of.
 *
 * A trade from the world this app is about, and a year — "Enlumineur-1342".
 * Everyone starts with one, because an empty field beside your first
 * contribution is a decision you did not ask to make, and an account with no
 * name cannot be shown next to what it wrote.
 */
create or replace function public.invent_handle()
returns text
language plpgsql
security definer
set search_path to ''
as $function$
declare
  trades text[] := array[
    'Cartographe', 'Chroniqueur', 'Annaliste', 'Copiste', 'Enlumineur',
    'Géographe', 'Archiviste', 'Arpenteur', 'Navigateur', 'Voyageur',
    'Graveur', 'Relieur', 'Scribe', 'Historien', 'Cosmographe',
    'Généalogiste', 'Herboriste', 'Astronome', 'Compagnon', 'Pèlerin',
    'Explorateur', 'Bibliothécaire', 'Antiquaire', 'Portulan'
  ];
  candidate text;
begin
  for attempt in 1..40 loop
    candidate :=
      trades[1 + floor(random() * array_length(trades, 1))::int]
      || '-'
      || (1000 + floor(random() * 900))::int;

    if not exists (
      select 1 from public.profiles p where lower(p.handle) = lower(candidate)
    ) then
      return candidate;
    end if;
  end loop;

  -- Forty draws in, the dice are not the problem. This one cannot collide.
  return 'Chroniqueur-'
    || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
end;
$function$;

-- Nobody needs to call it: the trigger below runs as its owner.
revoke execute on function public.invent_handle() from public, anon, authenticated;

/**
 * Handed out at the door.
 *
 * A name drawn in the application could be missed — a sign-up that half
 * failed, a version of the app that did not know about names — and a reader
 * with no row here would be anonymous next to their own work. Written where
 * the account itself is written, it cannot be.
 */
create or replace function public.give_a_handle()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  for attempt in 1..5 loop
    begin
      insert into public.profiles (user_id, handle)
      values (new.id, public.invent_handle());
      return new;
    exception when unique_violation then
      -- Two accounts drew the same name between the look and the write.
      -- Draw again; never refuse the sign-up over a name.
      null;
    end;
  end loop;

  insert into public.profiles (user_id, handle)
  values (
    new.id,
    'Chroniqueur-' || substr(replace(new.id::text, '-', ''), 1, 8)
  )
  on conflict (user_id) do nothing;
  return new;
end;
$function$;

create trigger give_a_handle_on_sign_up
  after insert on auth.users
  for each row execute function public.give_a_handle();

alter table public.profiles enable row level security;

-- The one table everyone reads. It is what puts a name beside a contribution.
create policy "un pseudonyme est public"
  on public.profiles for select
  to authenticated
  using (true);

-- And the only thing anyone may do to it is rename their own.
create policy "chacun renomme le sien"
  on public.profiles for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));;
