-- Le masque s'applique à la source plutôt qu'à l'arrivée.
--
-- Filtrer côté application aurait marché, mais aurait fait voyager la
-- géométrie de territoires destinés à être jetés — et la géométrie est ce qui
-- coûte cher ici. Écarté dès la liste des identifiants, un territoire masqué
-- n'est jamais demandé.
--
-- `security invoker` : `auth.uid()` est celui de l'appelant, et les policies
-- de `hidden_polities` s'appliquent telles quelles. Un visiteur non connecté
-- ne masque rien et voit donc la carte entière, ce qui est correct.
create or replace function public.polity_ids_at(at_year numeric, max_level integer default 2)
returns table(id uuid)
language sql
stable
security invoker
set search_path to ''
as $function$
  select p.id
  from public.polities p
  where p.start_year <= at_year
    and p.end_year >= at_year
    and max_level is not null
    and not exists (
      select 1
      from public.hidden_polities h
      where h.user_id = auth.uid()
        and h.name = p.name
    );
$function$;;
