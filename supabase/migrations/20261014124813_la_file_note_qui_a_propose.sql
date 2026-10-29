-- Qui a proposé la chose jugée.
--
-- Déductible pour un événement ou un personnage — sa ligne est toujours là.
-- Pas pour une ville ni un territoire : `promote_place` supprime la ligne de
-- son auteur, puisque la ville promue y ferait doublon. Le seul endroit où le
-- lien pouvait survivre était ici, et il n'y était pas.
--
-- Dénormalisé exprès pour les quatre autres genres aussi : une notification
-- doit tenir même le jour où son auteur efface sa propre ligne.
alter table public.review
  add column if not exists who uuid references auth.users(id) on delete cascade;

comment on column public.review.who is
  'Le compte qui a proposé la chose. Gardé même quand sa ligne disparaît.';

update public.review r set who = s.user_id
  from public.events s
 where r.who is null and r.kind = 'event' and s.id = r.source_id;

update public.review r set who = s.user_id
  from public.characters s
 where r.who is null and r.kind = 'character' and s.id = r.source_id;

update public.review r set who = s.user_id
  from public.folders s
 where r.who is null and r.kind = 'folder' and s.id = r.source_id;

update public.review r set who = s.user_id
  from public.trees s
 where r.who is null and r.kind = 'tree' and s.id = r.source_id;

create index if not exists review_who
  on public.review (who) where who is not null;;
