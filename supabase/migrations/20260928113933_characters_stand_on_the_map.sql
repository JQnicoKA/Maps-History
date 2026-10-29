-- Where someone stood.
--
-- A character now appears on the plate, from their birth to their death, at
-- one point. That point is part of declaring a person, and the form refuses a
-- new one without it.
--
-- Nullable all the same, and deliberately: eight people were written down
-- before the map knew about them, and there is no honest latitude to give a
-- name that arrived without one. They keep a null position, stay off the map,
-- and the form asks for one the next time anybody opens their card. Inventing
-- coordinates to satisfy a NOT NULL would put people in places they never were.
alter table public.characters
  add column longitude double precision,
  add column latitude double precision;

-- Half a position is not a position.
alter table public.characters
  add constraint characters_placed_whole check (
    (longitude is null) = (latitude is null)
  ),
  add constraint characters_longitude_range check (
    longitude is null or longitude between -180 and 180
  ),
  add constraint characters_latitude_range check (
    latitude is null or latitude between -90 and 90
  );

comment on column public.characters.longitude is
  'Where this person stands on the map, with latitude. Null for the rows that predate the feature.';;
