-- La seule requête que l'app fait sur `events` est devenue, depuis les comptes :
--   where user_id = auth.uid()            ← imposé par la policy RLS
--   order by start_year, start_month nulls first, start_day nulls first
-- L'index doit donc mener par le propriétaire, puis suivre exactement cet ordre
-- de tri — `nulls first` compris, sans quoi Postgres retrie après coup : une
-- année nue doit se lire avant les mois de la même année.
create index if not exists events_owner_chronology_idx
  on public.events (
    user_id,
    start_year,
    start_month nulls first,
    start_day nulls first
  );

-- Celui-ci ne menait que par l'année : utile quand la table appartenait à tout
-- le monde, redondant maintenant que chaque lecture commence par un compte.
drop index if exists public.events_chronology_idx;

-- Et celui-ci est entièrement contenu dans la première colonne du nouveau.
drop index if exists public.events_user_idx;

-- Jamais lu une seule fois : le filtre par type est appliqué dans l'app, sur
-- une liste déjà en mémoire, et ne descend pas jusqu'à SQL.
drop index if exists public.events_type_idx;;
