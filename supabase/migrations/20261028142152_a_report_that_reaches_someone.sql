-- Un signalement qui arrive quelque part.
--
-- Il ne faisait qu'un `insert` et s'arrêtait là. La ligne attendait qu'on
-- pense à consulter la table — alors que l'application promet « nous le
-- regardons sous 72 heures », une promesse que rien ne venait rappeler.
--
-- La chaîne devient celle de « Nous contacter », et pour les mêmes raisons :
-- déposer d'abord, expédier ensuite, noter ce qu'il est advenu. Un courriel
-- qui échoue ne coûte alors que le courriel.

alter table public.reports
  add column if not exists sent_at timestamptz,
  add column if not exists failure text;

comment on column public.reports.sent_at is
  'Quand l''avis est parti. Null tant qu''il n''est pas parti.';

/**
 * Dépose un signalement et rend de quoi en avertir.
 *
 * **Elle rendait `void`**, ce qui suffisait à qui ne voulait qu'écrire une
 * ligne. Pour qu'un courriel puisse la décrire, il lui faut le nom de ce qui
 * est signalé et l'adresse de qui le signale — deux choses que le client ne
 * doit pas fournir : l'une se lit dans la table signalée, l'autre dans
 * `auth.users`, et un client qui les donnerait pourrait faire accuser
 * n'importe quoi au nom de n'importe qui.
 *
 * **Aucune ligne rendue veut dire « déjà signalé »** : le `on conflict do
 * nothing` protège contre la double voix, et le `returning` reste alors vide.
 * C'est au courriel de ne pas partir deux fois.
 */
drop function if exists public.report_it(text, uuid, text, text);

create function public.report_it(
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
  moi uuid := auth.uid();
  nouvelle public.reports;
begin
  if moi is null then
    raise exception 'Il faut être connecté pour signaler.';
  end if;

  insert into public.reports (kind, source_id, reporter, reason, said)
  values (kind, source_id, moi, reason, nullif(btrim(said), ''))
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
grant execute on function public.report_it(text, uuid, text, text) to authenticated, service_role;

/** Note qu'un avis est parti, ou pourquoi il ne l'est pas — voir `message_was_sent`. */
create or replace function public.report_was_sent(which uuid, why text default null)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  update public.reports r
  set sent_at = case when why is null then now() else null end,
      failure = why
  where r.id = which and r.reporter = auth.uid();
end;
$$;

revoke all on function public.report_was_sent(uuid, text) from public, anon;
grant execute on function public.report_was_sent(uuid, text) to authenticated, service_role;;
