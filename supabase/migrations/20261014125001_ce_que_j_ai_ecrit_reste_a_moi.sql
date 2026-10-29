-- « C'est moi qui l'ai écrit », même quand la ligne publiée est celle de la
-- bibliothèque.
--
-- Sans cela, l'auteur d'une proposition admise rencontre son propre travail
-- dans le catalogue sans que rien ne le lui dise, et le pied de la carte lui
-- offre de le copier : il repartirait avec deux fois la même chose, sans
-- qu'aucun lien n'existe entre les deux. `mine` ne pouvait pas le savoir —
-- `judge` coupe `origin_id` — mais `review` le sait, c'est son métier.
--
-- `security definer` parce que `review` n'est lisible que par la
-- bibliothèque. Ne révèle rien d'autre : un booléen sur une ligne que
-- l'appelant a lui-même proposée.
create or replace function public.wrote_it(about text, which uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.review r
     where r.kind = about
       and r.became = which
       and r.state = 'admitted'
       and r.who = auth.uid()
  );
$$;

comment on function public.wrote_it(text, uuid) is
  'Vrai si cette entrée de la bibliothèque vient d''une proposition de l''appelant.';

create index if not exists review_became
  on public.review (kind, became) where became is not null;

revoke execute on function public.wrote_it(text, uuid) from public, anon;
grant execute on function public.wrote_it(text, uuid) to authenticated;;
