-- « Vous avez déjà quelque chose qui y ressemble. »
--
-- Le miroir d'`events_like` et de `characters_like`. Celles-là cherchent
-- dans la bibliothèque ce qui ressemble à ce qu'on **écrit** ; celles-ci
-- cherchent dans sa propre collection ce qui ressemble à ce qu'on s'apprête
-- à **copier**. La même question, qui n'était posée que dans un sens.
--
-- **Les seuils sont rigoureusement les mêmes**, et ils ont été mesurés :
-- une similarité de mots d'au moins 0,8 sur le titre, et deux ans d'écart —
-- vingt-cinq quand une des deux dates est approximative. Le commentaire de
-- `LikelyDuplicates` garde le chiffre qui l'a décidé : sur trente-neuf
-- événements, le titre seul levait quarante-six avertissements tous faux ;
-- avec l'année, trois, tous justes.
--
-- `security invoker`, donc la sécurité par ligne s'applique telle quelle :
-- on ne cherche que chez soi, et il n'y a rien à vérifier de plus.
--
-- Pour défaire : docs/defaire-doublons-avant-copie.sql
create or replace function public.my_events_like(
  said text,
  at_year integer,
  fuzzy boolean default false
)
returns table (
  id uuid,
  title text,
  year integer,
  approximate boolean,
  -- Écrit de sa main, ou pris ailleurs : les deux ne se perdent pas de la
  -- même façon, et la carte ne doit pas proposer la même chose des deux.
  written boolean
)
language sql
stable
set search_path to ''
as $function$
  select e.id, e.title, e.start_year, e.start_approx, e.origin_id is null
  from public.events e
  where e.user_id = auth.uid()
    and btrim(coalesce(said, '')) <> ''
    and at_year is not null
    and extensions.word_similarity(public.plain(said), public.plain(e.title)) >= 0.8
    and abs(e.start_year - at_year) <= case
      when fuzzy or e.start_approx then 25 else 2
    end
  order by extensions.word_similarity(public.plain(said), public.plain(e.title)) desc,
           e.id desc
  limit 3;
$function$;

create or replace function public.my_characters_like(
  said text,
  at_year integer,
  fuzzy boolean default false
)
returns table (
  id uuid,
  title text,
  year integer,
  approximate boolean,
  written boolean
)
language sql
stable
set search_path to ''
as $function$
  select c.id, c.name, c.birth_year, c.birth_approx, c.origin_id is null
  from public.characters c
  where c.user_id = auth.uid()
    and btrim(coalesce(said, '')) <> ''
    and at_year is not null
    and c.birth_year is not null
    and extensions.word_similarity(public.plain(said), public.plain(c.name)) >= 0.8
    and abs(c.birth_year - at_year) <= case
      when fuzzy or c.birth_approx then 25 else 2
    end
  order by extensions.word_similarity(public.plain(said), public.plain(c.name)) desc,
           c.id desc
  limit 3;
$function$;;
