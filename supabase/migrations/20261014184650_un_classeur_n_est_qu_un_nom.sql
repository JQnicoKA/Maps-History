alter table public.events
  add column folders text[] not null default '{}',
  add column importance public.event_importance not null default 'medium';;
