-- `Returned type character varying(255) does not match expected type text`.
--
-- `auth.users.email` est un `varchar(255)` et non un `text` — une colonne d'un
-- schéma qui n'est pas le nôtre, et dont le type ne se devine pas. Le titre
-- suit le même sort par précaution : il vient de trois tables différentes, et
-- il suffirait qu'une seule change de type un jour pour que la fonction cesse
-- de répondre sans que rien ne l'ait touchée.
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

  if nouvelle.id is null then
    return;
  end if;

  return query
  select
    nouvelle.id,
    nouvelle.kind::text,
    nouvelle.source_id,
    nouvelle.reason::text,
    nouvelle.said::text,
    (case nouvelle.kind
      when 'event' then (select e.title from public.events e where e.id = nouvelle.source_id)
      when 'character' then (select c.name from public.characters c where c.id = nouvelle.source_id)
      when 'tree' then (select t.name from public.trees t where t.id = nouvelle.source_id)
    end)::text,
    (select u.email::text from auth.users u where u.id = moi),
    nouvelle.created_at;
end;
$$;

revoke all on function public.report_it(text, uuid, text, text) from public, anon;
grant execute on function public.report_it(text, uuid, text, text) to authenticated, service_role;;
