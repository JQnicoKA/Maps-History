-- Défaire « le pseudonyme s'en va »
-- =================================
--
-- À coller dans l'éditeur SQL de Supabase, avec la restauration du code.
--
-- **Les pseudonymes eux-mêmes ne reviendront pas.** La colonne a été déposée
-- avec les cinq valeurs qu'elle portait, et rien ne les a conservées : elles
-- étaient tirées au sort, jamais montrées, jamais choisies. Ce script rend la
-- colonne et la mécanique qui en fabriquait ; les comptes existants en
-- recevront de nouveaux.
--
-- Ce que la série de migrations avait fait :
--   1. `functions_before_dropping_handle` — le texte exact des treize
--      fonctions qui lisaient le pseudonyme, mis de côté avant d'y toucher ;
--   2. onze d'entre elles réécrites pour rendre `null` au lieu du pseudonyme,
--      et `to_review` pour rendre l'identifiant du compte ;
--   3. `give_a_handle` renommée en `give_a_profile` et vidée de sa mécanique
--      de tirage au sort, `invent_handle` déposée, le déclencheur refait ;
--   4. `blocked_people` refaite pour rendre l'identifiant ;
--   5. la colonne `profiles.handle`, sa contrainte de forme et son index
--      d'unicité, déposés.

begin;

-- 1. La colonne et ses gardes.
alter table public.profiles add column if not exists handle text;

-- Un pseudonyme neuf pour chaque compte, puisque les anciens sont perdus.
update public.profiles
set handle = 'Chroniqueur-' || substr(replace(user_id::text, '-', ''), 1, 8)
where handle is null;

alter table public.profiles
  add constraint profiles_handle_shape check (
    length(handle) >= 3 and length(handle) <= 24
    and handle = btrim(handle)
    and handle ~ '^[A-Za-zÀ-ÖØ-öø-ÿ0-9][A-Za-zÀ-ÖØ-öø-ÿ0-9 ''-]*$'
  );

create unique index if not exists profiles_handle_unique
  on public.profiles (lower(handle));

-- 2. Les treize fonctions, rejouées **mot pour mot** depuis la sauvegarde.
--    C'est le chemin exact : aucune réécriture, aucune interprétation.
do $$
declare f record;
begin
  for f in select definition from public.functions_before_dropping_handle loop
    execute f.definition;
  end loop;
end $$;

-- 3. Le déclencheur reprend son ancien nom et son ancienne fonction.
drop trigger if exists give_a_profile_on_sign_up on auth.users;
drop function if exists public.give_a_profile();

create trigger give_a_handle_on_sign_up
  after insert on auth.users
  for each row execute function public.give_a_handle();

commit;

-- ---------------------------------------------------------------------------
-- Une fois la suppression acquise, la sauvegarde ne sert plus :
--
--   drop table public.functions_before_dropping_handle;
