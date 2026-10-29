-- L'incertitude est une propriété de la date, pas de ce qu'elle date : un
-- événement peut avoir un début sûr et une fin approximative, et une vie une
-- naissance devinée pour une mort attestée. Un drapeau par date, donc.
alter table public.events
  add column if not exists start_approx boolean not null default false,
  add column if not exists end_approx boolean not null default false;

alter table public.characters
  add column if not exists birth_approx boolean not null default false,
  add column if not exists death_approx boolean not null default false;;
