-- `column reference "kind" is ambiguous`, et c'est de naissance.
--
-- La version précédente était en `language sql` et ses paramètres pouvaient
-- s'appeler comme les colonnes de `reports` sans dommage. Réécrite en
-- `plpgsql` pour pouvoir rendre un enregistrement, elle a hérité des mêmes
-- noms — et PL/pgSQL, lui, refuse qu'un nom désigne à la fois une variable et
-- une colonne : `on conflict (kind, source_id, reporter)` devenait indécidable.
--
-- **La signature ne change pas**, et c'est la contrainte : le client et la
-- fonction de bord appellent par noms d'arguments, donc les renommer casserait
-- les deux. Les paramètres sont donc recopiés dans des variables locales dès
-- l'entrée — là où aucune table n'est en portée, le nom ne peut désigner que
-- le paramètre — et c'est elles seules qui paraissent ensuite dans le SQL.
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
declare
  -- Lues ici, et nulle part ailleurs : à cet endroit `kind` ne peut être que
  -- le paramètre, puisque aucune table n'est en portée.
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
