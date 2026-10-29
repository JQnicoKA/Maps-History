-- What kind of event this is; drives the glyph drawn on the map.
create type public.event_type as enum (
  'birth',
  'death',
  'marriage',
  'coronation',
  'battle',
  'conquest',
  'treaty',
  'revolution',
  'independence',
  'law',
  'construction',
  'exploration',
  'discovery',
  'culture',
  'disaster',
  'other'
);

alter table public.events
  add column type public.event_type not null default 'other';

create index events_type_idx on public.events (type);;
