-- Les colonnes de la bibliothèque se gardent.
--
-- Les policies laissent chacun modifier ses propres lignes, toutes colonnes
-- comprises. Parmi elles, quelques-unes ne sont pas au lecteur :
--
--   - `profiles.library` fait le conservateur ;
--   - `published`, `stars`, `origin_id`, `taken_at` sur `events`,
--     `characters` et `trees` disent ce qui est publié, combien de fois
--     c'est copié, et d'où vient un exemplaire.
--
-- Rien n'en était exploitable : l'escalade vers la bibliothèque butait sur
-- l'index unique `profiles_one_library`, et le catalogue ne montre que les
-- lignes du compte bibliothèque. Mais cela tenait par accident.
--
-- **Un garde plutôt que des droits par colonne.** `GRANT UPDATE (col, …)`
-- obligerait à accorder chaque future colonne à la main, faute de quoi
-- l'application recevrait « permission denied » ; ici, une colonne nouvelle
-- reste modifiable, et la liste de ce qui est protégé est écrite en clair.
--
-- **Qui passe.** Les portes `security definer` — `judge`, `copy_*`, `attach`,
-- `refresh_from_library`, le compteur d'étoiles — s'exécutent sous `postgres`,
-- comme l'éditeur SQL du tableau de bord. Seuls les appels directs de l'API,
-- sous `authenticated` ou `anon`, sont arrêtés. Le garde n'est donc surtout
-- pas `security definer` : il lit `current_user`, celui de l'appelant.
--
-- L'application n'écrit aucune de ces colonnes : vérifié dans `src/` le
-- 29 octobre 2026.

create or replace function private.garder_les_colonnes_de_la_bibliotheque()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.published or new.stars <> 0 or new.origin_id is not null or new.taken_at is not null then
      raise exception 'Seule la bibliothèque publie, compte les copies et rattache un exemplaire.'
        using errcode = '42501';
    end if;
  elsif new.published is distinct from old.published
     or new.stars is distinct from old.stars
     or new.origin_id is distinct from old.origin_id
     or new.taken_at is distinct from old.taken_at then
    raise exception 'Seule la bibliothèque publie, compte les copies et rattache un exemplaire.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function private.garder_le_titre_de_conservateur()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon')
     and (tg_op = 'INSERT' and new.library
          or tg_op = 'UPDATE' and new.library is distinct from old.library) then
    raise exception 'On ne se fait pas conservateur soi-même.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.garder_les_colonnes_de_la_bibliotheque() from public, anon, authenticated;
revoke all on function private.garder_le_titre_de_conservateur() from public, anon, authenticated;

create trigger garder_les_colonnes_de_la_bibliotheque
  before insert or update on public.events
  for each row execute function private.garder_les_colonnes_de_la_bibliotheque();
create trigger garder_les_colonnes_de_la_bibliotheque
  before insert or update on public.characters
  for each row execute function private.garder_les_colonnes_de_la_bibliotheque();
create trigger garder_les_colonnes_de_la_bibliotheque
  before insert or update on public.trees
  for each row execute function private.garder_les_colonnes_de_la_bibliotheque();

create trigger garder_le_titre_de_conservateur
  before insert or update on public.profiles
  for each row execute function private.garder_le_titre_de_conservateur();
