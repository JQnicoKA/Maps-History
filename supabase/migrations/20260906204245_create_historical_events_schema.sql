-- Historical events placed geographically and chronologically.
--
-- Dates are stored as a signed year plus optional month/day rather than a SQL
-- date: history needs years before 1 AD (negative) and imprecise dates ("1299",
-- "March 1453"), neither of which a `date` column can express.

create type public.event_importance as enum ('low', 'medium', 'high');

-- Subjects an event can be filed under: "Empire ottoman", "Royaume des Capétiens"…
create table public.folders (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(btrim(name)) > 0),
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) > 0),
  description text,

  start_year int not null,
  start_month smallint check (start_month between 1 and 12),
  start_day smallint check (start_day between 1 and 31),

  -- Present only for events that span time (a war, a reign).
  end_year int,
  end_month smallint check (end_month between 1 and 12),
  end_day smallint check (end_day between 1 and 31),

  longitude double precision not null check (longitude between -180 and 180),
  latitude double precision not null check (latitude between -90 and 90),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint start_day_needs_month check (start_day is null or start_month is not null),
  constraint end_day_needs_month check (end_day is null or end_month is not null),
  constraint end_parts_need_year check ((end_month is null and end_day is null) or end_year is not null),
  constraint end_after_start check (
    end_year is null
    or (end_year, coalesce(end_month, 12), coalesce(end_day, 31))
       >= (start_year, coalesce(start_month, 1), coalesce(start_day, 1))
  )
);

-- Importance belongs to the event/folder pair, not to the event: the fall of
-- Constantinople is major for "Empire ottoman" and minor for "Renaissance".
create table public.event_folders (
  event_id uuid not null references public.events (id) on delete cascade,
  folder_id uuid not null references public.folders (id) on delete cascade,
  importance public.event_importance not null default 'medium',
  primary key (event_id, folder_id)
);

create table public.event_photos (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  storage_path text not null,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  unique (event_id, storage_path)
);

-- The timeline reads events in chronological order; nulls first puts a bare
-- year before any dated event of that same year.
create index events_chronology_idx
  on public.events (start_year, start_month nulls first, start_day nulls first);
create index event_folders_folder_idx on public.event_folders (folder_id, importance);
create index event_photos_event_idx on public.event_photos (event_id, position);

create function public.touch_updated_at() returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger events_touch_updated_at
  before update on public.events
  for each row execute function public.touch_updated_at();

alter table public.folders enable row level security;
alter table public.events enable row level security;
alter table public.event_folders enable row level security;
alter table public.event_photos enable row level security;

-- TEMPORARY: single-user prototype with no accounts yet. When auth lands, these
-- four policies are what change — the schema stays as is.
create policy "prototype open access" on public.folders
  for all to anon, authenticated using (true) with check (true);
create policy "prototype open access" on public.events
  for all to anon, authenticated using (true) with check (true);
create policy "prototype open access" on public.event_folders
  for all to anon, authenticated using (true) with check (true);
create policy "prototype open access" on public.event_photos
  for all to anon, authenticated using (true) with check (true);;
