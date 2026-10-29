-- `mine` passe par `wrote_it` dans les huit portes qui le renvoient.
--
-- Substitution sur `pg_get_functiondef` plutôt que huit réécritures : ces
-- fonctions font six cents lignes à elles seules, et une seule sous-chaîne
-- change dans chacune. Chaque remplacement est vérifié — si la sous-chaîne
-- n'est pas là, la migration s'arrête au lieu de laisser une porte derrière.
do $migration$
declare
  job record;
  def text;
  made text;
begin
  for job in
    select * from (values
      ('search_events(text,numeric,numeric,double precision,double precision,double precision,text,integer,double precision,uuid)',
       'e.user_id = auth.uid() as mine',
       '(e.user_id = auth.uid() or public.wrote_it(''event'', e.id)) as mine'),
      ('search_characters(text,numeric,numeric,double precision,double precision,double precision,text,integer,double precision,uuid)',
       'c.user_id = auth.uid() as mine',
       '(c.user_id = auth.uid() or public.wrote_it(''character'', c.id)) as mine'),
      ('search_folders(text,numeric,numeric,double precision,double precision,double precision,text,integer,double precision,uuid)',
       'f.user_id = auth.uid() as mine',
       '(f.user_id = auth.uid() or public.wrote_it(''folder'', f.id)) as mine'),
      ('search_trees(text,numeric,numeric,double precision,double precision,double precision,text,integer,double precision,uuid)',
       't.user_id = auth.uid() as mine',
       '(t.user_id = auth.uid() or public.wrote_it(''tree'', t.id)) as mine'),
      ('shared_tree(uuid)',
       '''mine'', t.user_id = auth.uid(),',
       '''mine'', (t.user_id = auth.uid() or public.wrote_it(''tree'', t.id)),')
    ) as t(sig, was, instead)
  loop
    def := pg_get_functiondef(('public.' || job.sig)::regprocedure);
    made := replace(def, job.was, job.instead);
    if made = def then
      raise exception 'Sous-chaîne absente de % : %', job.sig, job.was;
    end if;
    execute made;
  end loop;
end
$migration$;;
