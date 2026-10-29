-- Les noms anglais, mis de côté avant la traduction.
--
-- **Les noms seuls et non la table entière**, et c'est un choix qu'il faut
-- dire : `polities` pèse 27 Mo sur les 56 de la base, presque tout en
-- géométrie, et la traduction ne touche pas un seul point de tracé. Une copie
-- complète aurait doublé le plus gros objet de la base pour sauvegarder des
-- polygones que rien ne menace — le projet a déjà déposé 76 Mo de tables pour
-- cette raison. Ces deux tables-ci pèsent moins d'un mégaoctet et remettent
-- l'état d'avant exactement, par leur clé primaire.
--
-- `polity_wash` est copiée en entier parce qu'elle est entière minuscule, et
-- parce que son nom **est** sa clé primaire : la traduction la renomme en
-- même temps que `polities`, sans quoi chaque territoire perdrait son lavis et
-- retomberait sur la couleur tirée de son nom.
create table if not exists public.polities_english_names (
  id uuid primary key,
  name text not null
);

insert into public.polities_english_names (id, name)
select id, name from public.polities
on conflict (id) do nothing;

create table if not exists public.polity_wash_english_names (
  name text primary key,
  wash text
);

insert into public.polity_wash_english_names (name, wash)
select name, wash from public.polity_wash
on conflict (name) do nothing;

-- Personne ne lit ces deux tables depuis l'application : elles sont un filet,
-- pas une source. Aucune politique de lecture, donc, et le rôle `anon` n'y a
-- pas accès.
alter table public.polities_english_names enable row level security;
alter table public.polity_wash_english_names enable row level security;;
