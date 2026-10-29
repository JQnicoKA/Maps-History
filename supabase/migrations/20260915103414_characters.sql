-- Les personnages : les gens auxquels un événement se rattache.
--
-- Mêmes règles de date que les événements — une année suffit, un jour exige son
-- mois — parce que « né en 1769 » est une donnée juste et que le sélecteur de
-- l'app sait déjà l'exprimer. Naissance et mort sont toutes deux facultatives :
-- on connaît parfois un nom sans ses dates, et on connaît des vivants.
create table if not exists public.characters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  bio text,
  birth_year integer,
  birth_month integer check (birth_month >= 1 and birth_month <= 12),
  birth_day integer check (birth_day >= 1 and birth_day <= 31),
  death_year integer,
  death_month integer check (death_month >= 1 and death_month <= 12),
  death_day integer check (death_day >= 1 and death_day <= 31),
  created_at timestamptz not null default now(),

  constraint characters_name_check check (length(btrim(name)) > 0),
  constraint birth_day_needs_month check (birth_day is null or birth_month is not null),
  constraint birth_parts_need_year check ((birth_month is null and birth_day is null) or birth_year is not null),
  constraint death_day_needs_month check (death_day is null or death_month is not null),
  constraint death_parts_need_year check ((death_month is null and death_day is null) or death_year is not null),
  -- Personne ne meurt avant d'être né. Même forme que `end_after_start`.
  constraint death_after_birth check (
    death_year is null or birth_year is null or
    row(death_year, coalesce(death_month, 12), coalesce(death_day, 31))
      >= row(birth_year, coalesce(birth_month, 1), coalesce(birth_day, 1))
  )
);

create table if not exists public.character_photos (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters (id) on delete cascade,
  storage_path text not null,
  position integer not null default 0,
  source text
);

create index if not exists character_photos_character_idx
  on public.character_photos (character_id, position);

-- Le lien : un événement rassemble des gens, une vie traverse des événements.
create table if not exists public.event_characters (
  event_id uuid not null references public.events (id) on delete cascade,
  character_id uuid not null references public.characters (id) on delete cascade,
  primary key (event_id, character_id)
);

create index if not exists event_characters_character_idx
  on public.event_characters (character_id);

alter table public.characters enable row level security;
alter table public.character_photos enable row level security;
alter table public.event_characters enable row level security;

create policy "prototype open access" on public.characters
  for all to anon, authenticated using (true) with check (true);
create policy "prototype open access" on public.character_photos
  for all to anon, authenticated using (true) with check (true);
create policy "prototype open access" on public.event_characters
  for all to anon, authenticated using (true) with check (true);;
