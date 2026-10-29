-- Where a thing sits on the continuous axis, at both ends.
--
-- The catalogue filtered on whole years, which is all a reader asking for a
-- century needs. Asking for "a week either side of the 14th of July 1789" is
-- a different question and a year cannot hold the answer.
--
-- The formula is the one the application already uses — `toSortKey` in
-- `historicalDate.ts`: the year, plus the month as a twelfth, plus the day as
-- a three-hundred-and-seventy-second. **The two must agree**, because the
-- reader's bounds are computed there and compared here. 372 is 12 × 31, which
-- keeps every day of every month inside its own month.
--
-- A missing month or day means "not known to that precision", so it reads as
-- the first — the same reading the application makes. And a thing with no end
-- ends where it began.
alter table public.events
  add column from_key numeric generated always as (
    start_year
    + (coalesce(start_month, 1) - 1) / 12.0
    + (coalesce(start_day, 1) - 1) / 372.0
  ) stored,
  add column to_key numeric generated always as (
    coalesce(end_year, start_year)
    + (coalesce(end_month, case when end_year is null then start_month else 1 end, 1) - 1) / 12.0
    + (coalesce(end_day, case when end_year is null then start_day else 1 end, 1) - 1) / 372.0
  ) stored;

alter table public.characters
  add column from_key numeric generated always as (
    case when birth_year is null then null else
      birth_year
      + (coalesce(birth_month, 1) - 1) / 12.0
      + (coalesce(birth_day, 1) - 1) / 372.0
    end
  ) stored,
  add column to_key numeric generated always as (
    case when death_year is null then null else
      death_year
      + (coalesce(death_month, 1) - 1) / 12.0
      + (coalesce(death_day, 1) - 1) / 372.0
    end
  ) stored;

create index events_shared_from_key_idx on public.events (from_key) where shared;
create index characters_shared_from_key_idx on public.characters (from_key)
  where shared;;
