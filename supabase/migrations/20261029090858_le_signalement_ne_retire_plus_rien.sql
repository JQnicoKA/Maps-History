-- Un signalement prévient, il ne retire plus rien.
--
-- Trois signalements, de n'importe quels comptes, retiraient une entrée du
-- catalogue. Or rien n'y entre sans avoir été relu, chaque signalement part
-- par courriel au conservateur, et un compte se crée en une minute : trois
-- comptes jetables suffisaient à vider la bibliothèque. Le retrait redevient
-- une décision, prise après lecture.
--
-- `withheld` reste : c'est là qu'on inscrit à la main ce qu'on retire, et les
-- portes du catalogue continuent de la lire.

drop trigger if exists withhold_when_reported_enough on public.reports;
drop function if exists public.withhold_when_reported();

-- Ce qui reste retiré alors que l'entrée n'existe plus.
delete from public.withheld w
where (w.kind = 'event' and not exists (select 1 from public.events e where e.id = w.source_id))
   or (w.kind = 'character' and not exists (select 1 from public.characters c where c.id = w.source_id))
   or (w.kind = 'tree' and not exists (select 1 from public.trees t where t.id = w.source_id));

-- La cadence, lue par `report_it` à chaque appel. Couvre aussi la clé
-- étrangère `reports_reporter_fkey`, jusqu'ici sans index.
create index if not exists reports_reporter_recent_idx
  on public.reports (reporter, created_at desc);

-- Trois par heure, dix par jour. Chaque signalement est un courriel : sans
-- borne, un seul compte épuisait le quota quotidien de Resend. Les messages
-- sont écrits pour être lus — la fonction de bord `report` les rend tels quels.
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
  dans_l_heure int;
  dans_la_journee int;
begin
  if moi is null then
    raise exception 'Il faut être connecté pour signaler.';
  end if;

  select
    count(*) filter (where r.created_at > now() - interval '1 hour'),
    count(*)
  into dans_l_heure, dans_la_journee
  from public.reports r
  where r.reporter = moi
    and r.created_at > now() - interval '1 day';

  if dans_l_heure >= 3 then
    raise exception 'Vous avez déjà fait trois signalements dans l''heure. Nous les regardons : réessayez un peu plus tard.';
  end if;
  if dans_la_journee >= 10 then
    raise exception 'Vous avez atteint dix signalements aujourd''hui. Si quelque chose presse, écrivez-nous depuis « Nous contacter ».';
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
grant execute on function public.report_it(text, uuid, text, text) to authenticated, service_role;
