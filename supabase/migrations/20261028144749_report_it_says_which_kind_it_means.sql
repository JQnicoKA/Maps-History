-- Deuxième essai, et le premier n'avait réglé que la moitié.
--
-- Recopier les paramètres dans des variables locales a bien désambiguïsé les
-- **valeurs** — `values (v_kind, …)` ne prête plus à confusion. Mais les
-- paramètres restent en portée, et la liste `on conflict (kind, source_id,
-- reporter)` désigne des **colonnes** : le même nom y vaut encore deux choses,
-- et PL/pgSQL refuse toujours.
--
-- `#variable_conflict use_column` tranche une fois pour toutes : dans cette
-- fonction, un nom qui peut être une colonne en est une. C'est sans risque ici
-- parce que plus aucune valeur ne passe par un nom nu — elles passent toutes
-- par `v_…`, `moi` ou `nouvelle`, qui ne sont les colonnes de rien.
--
-- La signature ne change pas : le client et la fonction de bord appellent par
-- noms d'arguments, et les renommer casserait les deux.
create or replace function public.report_it(
  kind text,
  source_id uuid,
  reason text,
  said text default null
)
returns table(
  id uuid,
  genre text,
  cible uuid,
  motif text,
  commentaire text,
  titre text,
  par text,
  at timestamptz
)
language plpgsql
security definer
set search_path to ''
as $$
#variable_conflict use_column
declare
  -- Lues ici, où aucune table n'est en portée : le nom ne peut désigner que
  -- le paramètre, `use_column` ou non.
  v_kind text := kind;
  v_source uuid := source_id;
  v_reason text := reason;
  v_said text := nullif(btrim(said), '');
  moi uuid := auth.uid();
  nouvelle public.reports;
begin
  if moi is null then
    raise exception 'Il faut être connecté pour signaler.';
  end if;

  insert into public.reports (kind, source_id, reporter, reason, said)
  values (v_kind, v_source, moi, v_reason, v_said)
  on conflict (kind, source_id, reporter) do nothing
  returning * into nouvelle;

  -- Déjà signalé par ce lecteur : rien d'écrit, rien à dire.
  if nouvelle.id is null then
    return;
  end if;

  return query
  select
    nouvelle.id,
    nouvelle.kind,
    nouvelle.source_id,
    nouvelle.reason,
    nouvelle.said,
    case nouvelle.kind
      when 'event' then (select e.title from public.events e where e.id = nouvelle.source_id)
      when 'character' then (select c.name from public.characters c where c.id = nouvelle.source_id)
      when 'tree' then (select t.name from public.trees t where t.id = nouvelle.source_id)
    end,
    (select u.email from auth.users u where u.id = moi),
    nouvelle.created_at;
end;
$$;

revoke all on function public.report_it(text, uuid, text, text) from public, anon;
grant execute on function public.report_it(text, uuid, text, text) to authenticated, service_role;;
