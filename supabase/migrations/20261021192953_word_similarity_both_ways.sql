-- La ressemblance se mesure dans les deux sens.
--
-- `word_similarity(aiguille, botte)` dit quelle part de **l'aiguille** se
-- retrouve dans la botte, et ce n'est pas symétrique. « Thierry » tient tout
-- entier dans « Thierry Ier » — 1,00 — mais « Thierry Ier » ne tient pas
-- dans « Thierry » — 0,727.
--
-- D'où un défaut qui ne se voyait que depuis peu, quand la même question a
-- commencé à se poser dans les deux sens : en **écrivant** « Thierry », la
-- bibliothèque proposait bien son « Thierry Ier » ; en **copiant**
-- « Thierry Ier », personne ne signalait le « Thierry » qu'on avait déjà.
-- Le seuil était le même, la mesure non.
--
-- Le plus grand des deux sens rend la mesure symétrique, donc la question
-- identique quel que soit le côté d'où on la pose. Mesuré sur une vraie
-- collection avant d'être posé : quarante correspondances avec la
-- bibliothèque dans les deux versions, et zéro faux positif chez soi. Le
-- seuil de 0,8, lui, ne bouge pas.
--
-- Pour défaire : docs/defaire-doublons-avant-copie.sql
do $$
declare
  cible text;
  d text;
  avant integer;
begin
  foreach cible in array array[
    'events_like', 'characters_like', 'my_events_like', 'my_characters_like'
  ]
  loop
    select pg_get_functiondef(p.oid) into strict d
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = cible;

    avant := (length(d) - length(replace(d, 'extensions.word_similarity', ''))) 
             / length('extensions.word_similarity');

    d := regexp_replace(
      d,
      'extensions\.word_similarity\(public\.plain\(said\), public\.plain\((\w+\.\w+)\)\)',
      'greatest(' ||
      'extensions.word_similarity(public.plain(said), public.plain(\1)), ' ||
      'extensions.word_similarity(public.plain(\1), public.plain(said)))',
      'g'
    );

    -- Chaque appel doit en être devenu deux : sinon la substitution a manqué
    -- quelque part, et une des trois mesures de la fonction — le rang, le
    -- seuil, le tri — serait restée boiteuse.
    if (length(d) - length(replace(d, 'extensions.word_similarity', '')))
       / length('extensions.word_similarity') <> avant * 2 then
      raise exception 'substitution incomplète dans %', cible;
    end if;

    execute d;
  end loop;
end $$;;
