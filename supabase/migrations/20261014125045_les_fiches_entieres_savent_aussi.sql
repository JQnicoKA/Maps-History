-- Les trois fiches entières portent deux `mine` : celui de la chose, et celui
-- des choses qu'elle traîne avec elle — les classeurs où un événement est
-- rangé, les arbres où un personnage se tient, les événements d'un classeur.
-- Chacune de ces lignes offre aussi une copie, donc chacune doit savoir.
do $migration$
declare
  job record;
  def text;
  made text;
begin
  for job in
    select * from (values
      ('shared_event(uuid)', 1,
       '''mine'', e.user_id = auth.uid(),',
       '''mine'', (e.user_id = auth.uid() or public.wrote_it(''event'', e.id)),'),
      ('shared_event(uuid)', 2,
       'f.user_id = auth.uid() as mine',
       '(f.user_id = auth.uid() or public.wrote_it(''folder'', f.id)) as mine'),
      ('shared_character(uuid)', 1,
       '''mine'', c.user_id = auth.uid(),',
       '''mine'', (c.user_id = auth.uid() or public.wrote_it(''character'', c.id)),'),
      ('shared_character(uuid)', 2,
       't.user_id = auth.uid() as mine',
       '(t.user_id = auth.uid() or public.wrote_it(''tree'', t.id)) as mine'),
      ('shared_folder(uuid)', 1,
       '''mine'', f.user_id = auth.uid(),',
       '''mine'', (f.user_id = auth.uid() or public.wrote_it(''folder'', f.id)),'),
      ('shared_folder(uuid)', 2,
       'e.user_id = auth.uid() as mine',
       '(e.user_id = auth.uid() or public.wrote_it(''event'', e.id)) as mine')
    ) as t(sig, step, was, instead)
    order by sig, step
  loop
    def := pg_get_functiondef(('public.' || job.sig)::regprocedure);
    made := replace(def, job.was, job.instead);
    if made = def then
      raise exception 'Sous-chaîne absente de % (%) : %', job.sig, job.step, job.was;
    end if;
    execute made;
  end loop;
end
$migration$;;
