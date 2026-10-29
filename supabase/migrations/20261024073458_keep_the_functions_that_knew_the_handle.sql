-- Les définitions d'avant, mises de côté avant de retirer le pseudonyme.
--
-- Onze fonctions le lisent, de six façons différentes : en colonne d'un
-- `returns table`, en clé d'un objet JSON, en critère de tri. Les réécrire à
-- la main serait onze occasions de se tromper sur un corps de cent lignes dont
-- le pseudonyme n'occupe qu'un mot.
--
-- Elles sont donc retouchées par remplacement textuel, ce qui est mécanique et
-- vérifiable — et cette table garde le texte exact d'avant, de sorte que
-- défaire se réduise à rejouer ce qu'elle contient.
create table if not exists public.functions_before_dropping_handle (
  name text primary key,
  definition text not null,
  kept_at timestamptz not null default now()
);

insert into public.functions_before_dropping_handle (name, definition)
select p.proname, pg_get_functiondef(p.oid)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind = 'f'
  and pg_get_functiondef(p.oid) ilike '%handle%'
on conflict (name) do nothing;

alter table public.functions_before_dropping_handle enable row level security;

select name from public.functions_before_dropping_handle order by name;;
