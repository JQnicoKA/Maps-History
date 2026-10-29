-- Une seule ligne, dans un compte d'essai : la copie du classeur « Empire
-- Romain » par Copiste-1782. Les quatre autres tables n'en portaient aucune.
delete from public.copies where kind = 'folder';

alter table public.copies drop constraint copies_kind_check;
alter table public.copies add constraint copies_kind_check
  check (kind = any (array['event','character','tree','territory','place']));

alter table public.reports drop constraint reports_kind_check;
alter table public.reports add constraint reports_kind_check
  check (kind = any (array['event','character','tree','territory','place']));

alter table public.review drop constraint review_kind;
alter table public.review add constraint review_kind
  check (kind = any (array['event','character','tree','territory','place']));

alter table public.dismissed drop constraint dismissed_kind;
alter table public.dismissed add constraint dismissed_kind
  check (kind = any (array['event','character','tree','territory','place']));;
