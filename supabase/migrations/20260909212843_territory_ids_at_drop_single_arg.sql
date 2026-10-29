-- L'ancienne signature sans max_level rendrait l'appel à un seul argument
-- ambigu pour PostgREST : la version à deux arguments la remplace.
drop function public.territory_ids_at(numeric);;
