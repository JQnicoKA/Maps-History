-- Savoir si l'entrée dont vient un exemplaire a bougé depuis qu'on l'a prise.
--
-- Une seule colonne suffit, et c'est le petit tour de force de ce
-- découpage. `taken_at` retient **le moment où on a pris**, et elle répond
-- aux deux questions à la fois :
--
-- - *y a-t-il du neuf ?*  `entrée.updated_at > taken_at`
-- - *l'ai-je modifié ?*   `mon.updated_at > taken_at`
--
-- On avait d'abord songé à y mettre la date de l'entrée au moment de la
-- copie. Ça ne marche pas : mon `updated_at` vaut alors le moment de la
-- copie, qui est postérieur, et toute copie fraîche se serait déclarée
-- modifiée. Le moment de la prise, lui, est le même pour les deux
-- comparaisons, et une copie qui vient de naître a ses deux dates égales.

alter table public.characters add column updated_at timestamptz not null default now();
alter table public.folders add column updated_at timestamptz not null default now();
alter table public.trees add column updated_at timestamptz not null default now();

create trigger characters_touch_updated_at before update on public.characters
  for each row execute function public.touch_updated_at();
create trigger folders_touch_updated_at before update on public.folders
  for each row execute function public.touch_updated_at();
create trigger trees_touch_updated_at before update on public.trees
  for each row execute function public.touch_updated_at();

alter table public.events add column taken_at timestamptz;
alter table public.characters add column taken_at timestamptz;
alter table public.folders add column taken_at timestamptz;
alter table public.trees add column taken_at timestamptz;

comment on column public.events.taken_at is
  'Quand cet exemplaire a été pris, ou rafraîchi. Null pour ce qu''on a écrit.';

/**
 * Une écriture dans une table fille vieillit sa mère.
 *
 * Sans ceci, ajouter une photographie à une entrée de la bibliothèque ne
 * bougerait pas son `updated_at`, et personne ne serait jamais prévenu : la
 * substance d'un événement n'est pas seulement dans sa ligne, elle est dans
 * ses photos et dans sa distribution.
 *
 * Générique, par les arguments du déclencheur, parce qu'il y a six tables
 * filles et qu'écrire six fois la même fonction c'est en écrire cinq de
 * trop. `to_jsonb` plutôt qu'un accès direct au champ : le nom de la colonne
 * n'est connu qu'à l'exécution.
 */
create or replace function public.touch_parent()
returns trigger
language plpgsql security definer
set search_path to ''
as $$
declare
  ligne jsonb;
  clef uuid;
begin
  if tg_op = 'DELETE' then
    ligne := to_jsonb(old);
  else
    ligne := to_jsonb(new);
  end if;

  clef := (ligne ->> tg_argv[1])::uuid;
  if clef is not null then
    execute format(
      'update public.%I set updated_at = now() where id = $1', tg_argv[0]
    ) using clef;
  end if;
  return null;
end;
$$;

create trigger event_photos_touch_event
  after insert or update or delete on public.event_photos
  for each row execute function public.touch_parent('events', 'event_id');

create trigger event_characters_touch_event
  after insert or update or delete on public.event_characters
  for each row execute function public.touch_parent('events', 'event_id');

create trigger character_photos_touch_character
  after insert or update or delete on public.character_photos
  for each row execute function public.touch_parent('characters', 'character_id');

-- Le classeur, et non l'événement : ranger un événement quelque part change
-- la composition du classeur, pas l'événement lui-même.
create trigger event_folders_touch_folder
  after insert or update or delete on public.event_folders
  for each row execute function public.touch_parent('folders', 'folder_id');

create trigger tree_members_touch_tree
  after insert or update or delete on public.tree_members
  for each row execute function public.touch_parent('trees', 'tree_id');

create trigger tree_links_touch_tree
  after insert or update or delete on public.tree_links
  for each row execute function public.touch_parent('trees', 'tree_id');

-- Les copies déjà prises reçoivent leur date de prise : sans elle, elles ne
-- sauraient jamais qu'une correction les attend. `created_at` est la seule
-- approximation honnête dont on dispose pour le passé.
update public.events set taken_at = created_at where origin_id is not null;
update public.characters set taken_at = created_at where origin_id is not null;
update public.folders set taken_at = created_at where origin_id is not null;
update public.trees set taken_at = created_at where origin_id is not null;;
