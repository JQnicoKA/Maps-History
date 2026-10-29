-- Le pseudonyme cesse d'être envoyé.
--
-- **La valeur est remplacée, pas la colonne.** Retirer `author` des
-- `returns table` obligerait à supprimer puis recréer onze fonctions dont le
-- corps fait parfois cent lignes — onze occasions de se tromper sur un mot.
-- En rendant `null` à la place, aucune signature ne change, aucun appel ne
-- casse, et le pseudonyme ne quitte plus le serveur. L'application ne lisait
-- de toute façon jamais cette colonne : elle était envoyée à chaque recherche
-- et jetée à l'arrivée.
--
-- Les deux fonctions de modération — `to_review` et `blocked_people` — sont
-- traitées à part : elles ne sont appelées par aucun écran, et le pseudonyme y
-- était la seule étiquette lisible par un humain. Elles reçoivent
-- l'identifiant du compte, qui est ce qui désigne vraiment quelqu'un.
--
-- Le texte d'avant est dans `functions_before_dropping_handle`.
do $$
declare
  f record;
  neuf text;
begin
  for f in
    select name, definition from public.functions_before_dropping_handle
    where name not in ('invent_handle', 'blocked_people')
  loop
    neuf := f.definition;

    -- Les bibliothèques : plus d'auteur du tout.
    neuf := replace(neuf, 'pr.handle as author', 'null::text as author');
    neuf := replace(neuf, 'keeper.handle as author', 'null::text as author');
    neuf := replace(neuf, '''author'', pr.handle', '''author'', null::text');
    neuf := replace(neuf, 'pr.handle, c.stars', 'null::text, c.stars');
    neuf := replace(neuf, 'pr.handle, e.stars', 'null::text, e.stars');

    -- La modération garde de quoi désigner un compte.
    neuf := replace(neuf, 'q.title, pr.handle,', 'q.title, pr.user_id::text,');

    -- La copie d'arbre ne retient plus le nom de celui qui l'a planté.
    neuf := replace(neuf, 'select pr.handle from public.profiles pr',
                          'select null::text from public.profiles pr');

    -- Le profil se crée toujours, sans pseudonyme à inventer.
    neuf := replace(neuf, 'insert into public.profiles (user_id, handle)',
                          'insert into public.profiles (user_id)');
    neuf := replace(neuf, 'values (new.id, public.invent_handle());',
                          'values (new.id);');

    if neuf <> f.definition then
      execute neuf;
    end if;
  end loop;
end $$;

select p.proname as cite_encore_le_pseudo
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prokind = 'f'
  and pg_get_functiondef(p.oid) ilike '%handle%'
order by 1;;
