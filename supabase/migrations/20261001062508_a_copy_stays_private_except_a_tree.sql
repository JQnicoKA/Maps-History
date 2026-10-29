-- A copy never goes back into the chronicle.
--
-- This is the rule that keeps the catalogue from filling with the same thing
-- a hundred times. Taking a copy is how a reader gets something into their
-- own collection; sharing it again would put a second Marignan beside the
-- first, with none of the stars and none of the history, and the hundred and
-- first reader would have a hundred to choose between.
--
-- **Trees are the exception, deliberately.** A genealogy taken from somebody
-- else is a starting point rather than a finished thing: the reader adds a
-- branch, corrects a filiation, extends it three generations — and what they
-- end with is their work, worth offering back. The other four arrive
-- complete, and a copy of a complete thing is only a copy.
--
-- Enforced here and not in the application, because this is the one place no
-- screen can route around. The copies already made are private, so nothing
-- has to be fixed first.
alter table public.events
  add constraint events_copies_stay_private
  check (origin_id is null or not shared);

alter table public.characters
  add constraint characters_copies_stay_private
  check (origin_id is null or not shared);

alter table public.folders
  add constraint folders_copies_stay_private
  check (origin_id is null or not shared);

alter table public.drawn_polities
  add constraint drawn_polities_copies_stay_private
  check (origin_id is null or not shared);;
