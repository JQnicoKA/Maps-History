-- Une longueur maximale pour chaque texte qu'un compte peut écrire.
--
-- Sans elles, un compte malveillant pouvait remplir la base de textes de
-- plusieurs mégaoctets, par l'app ou en appelant l'API directement. Les
-- plafonds sont larges (le plus long titre écrit jusqu'ici fait 61 caractères,
-- la plus longue description 1 472) et l'app les reprend dans
-- `src/config/limits.ts`, pour que ses champs s'arrêtent avant la base.

-- Un classeur : 30 au plus par fiche, de 60 caractères au plus.
-- Une contrainte CHECK ne peut pas parcourir un tableau par sous-requête :
-- d'où cette fonction immuable.
create or replace function private.classeurs_raisonnables(noms text[])
returns boolean
language sql
immutable
set search_path to ''
as $$
  select noms is null or (
    cardinality(noms) <= 30
    and not exists (select 1 from unnest(noms) n where length(n) > 60)
  );
$$;

alter table public.events
  add constraint events_title_length check (length(title) <= 200),
  add constraint events_description_length check (description is null or length(description) <= 10000),
  add constraint events_folders_length check (private.classeurs_raisonnables(folders));

alter table public.characters
  add constraint characters_name_length check (length(name) <= 120),
  add constraint characters_bio_length check (bio is null or length(bio) <= 10000),
  add constraint characters_folders_length check (private.classeurs_raisonnables(folders));

alter table public.trees
  add constraint trees_name_length check (length(name) <= 120),
  add constraint trees_note_length check (note is null or length(note) <= 2000);

alter table public.tree_members
  add constraint tree_members_text_length check (text is null or length(text) <= 80),
  add constraint tree_members_note_length check (note is null or length(note) <= 500);

alter table public.drawn_polities
  add constraint drawn_polities_name_length check (length(name) <= 120),
  -- Les traits du pinceau : quelques dizaines de kilo-octets pour un dessin
  -- ordinaire. Deux millions de caractères laissent une très large marge.
  add constraint drawn_polities_strokes_length check (strokes is null or length(strokes::text) <= 2000000);

alter table public.drawn_places
  add constraint drawn_places_name_length check (length(name) <= 120);

alter table public.event_photos
  add constraint event_photos_source_length check (source is null or length(source) <= 500),
  add constraint event_photos_path_length check (length(storage_path) <= 300);

alter table public.character_photos
  add constraint character_photos_source_length check (source is null or length(source) <= 500),
  add constraint character_photos_path_length check (length(storage_path) <= 300);

alter table public.hidden_polities
  add constraint hidden_polities_name_length check (length(name) <= 200);

-- Écrits par les portes `report_was_sent` et `message_was_sent`, que tout
-- compte peut appeler pour ses propres lignes.
alter table public.reports
  add constraint reports_failure_length check (failure is null or length(failure) <= 1000);

alter table public.contact_messages
  add constraint contact_messages_failure_length check (failure is null or length(failure) <= 1000);
