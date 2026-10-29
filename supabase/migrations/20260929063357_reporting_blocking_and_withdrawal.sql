-- What a reader can do about somebody else's contribution.
--
-- Three things, and they are not interchangeable. **Report** says "this
-- should not be here" and is addressed to whoever keeps the chronicle.
-- **Block** says "I do not want to see this person" and is addressed to
-- nobody — it changes one reader's catalogue and no one else's. **Withdrawal**
-- is what happens on its own once enough readers have said the first thing.

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (
    kind in ('event', 'folder', 'character', 'tree', 'territory')
  ),
  source_id uuid not null,
  reporter uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  reason text not null check (
    reason in ('offensive', 'wrong', 'spam', 'stolen', 'other')
  ),
  said text check (said is null or length(said) <= 600),
  created_at timestamptz not null default now(),
  -- One voice each: a reader who reports the same thing twice is one reader
  -- who disagrees, not two.
  unique (kind, source_id, reporter)
);

alter table public.reports enable row level security;

create policy "on signale en son nom"
  on public.reports for insert
  to authenticated
  with check (reporter = (select auth.uid()));

-- Read back so a card can say "vous l'avez déjà signalé"; never anybody
-- else's, so nobody can learn who reported them.
create policy "on voit ses propres signalements"
  on public.reports for select
  to authenticated
  using (reporter = (select auth.uid()));

create table public.blocks (
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  blocked uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, blocked),
  constraint blocks_not_oneself check (user_id <> blocked)
);

alter table public.blocks enable row level security;

create policy "on gère ses propres blocages"
  on public.blocks for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Taken out of the catalogue, whatever its owner says.
--
-- A table rather than a column on each of the five, for one reason that
-- matters: there is no policy by which an owner could write this. `shared` is
-- theirs; this is not.
create table public.withheld (
  kind text not null,
  source_id uuid not null,
  reports integer not null,
  at timestamptz not null default now(),
  primary key (kind, source_id)
);

alter table public.withheld enable row level security;
-- No policy at all: nothing but the trigger below, which runs as its owner,
-- ever touches this table.

/**
 * How many readers have to say so before something leaves the catalogue.
 *
 * Three, and the number is a judgement. One would let a single reader erase
 * anything they disliked; ten, in a chronicle this size, would mean nothing
 * is ever withdrawn. Three costs three separate accounts to abuse and still
 * answers quickly when something is genuinely wrong.
 *
 * Withdrawal is not a verdict. It takes the thing out of everybody's search
 * until somebody looks — the owner keeps it, and nothing is deleted.
 */
create or replace function public.withhold_when_reported()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  voices integer;
begin
  select count(*) into voices
  from public.reports r
  where r.kind = new.kind and r.source_id = new.source_id;

  if voices >= 3 then
    insert into public.withheld (kind, source_id, reports)
    values (new.kind, new.source_id, voices)
    on conflict (kind, source_id)
      do update set reports = excluded.reports;
  end if;

  return new;
end;
$function$;

create trigger withhold_when_reported_enough
  after insert on public.reports
  for each row execute function public.withhold_when_reported();

/** Reports somebody's contribution. Says nothing to its author. */
create or replace function public.report_it(
  kind text,
  source_id uuid,
  reason text,
  said text default null
)
returns void
language sql
security definer
set search_path to ''
as $function$
  insert into public.reports (kind, source_id, reporter, reason, said)
  values (kind, source_id, auth.uid(), reason, nullif(btrim(said), ''))
  on conflict (kind, source_id, reporter) do nothing;
$function$;

revoke execute on function public.report_it(text, uuid, text, text)
  from public, anon;;
