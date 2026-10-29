-- Les villes du lecteur : la moitié manquante du triplet de la carte.
--
-- La carte tenait déjà ce schéma pour les territoires — un jeu de référence
-- que personne ne modifie (`polities`), ce que le lecteur ajoute
-- (`drawn_polities`), ce qu'il masque (`hidden_polities`). Les lieux n'en
-- avaient que le premier tiers. Voici les deux autres.
--
-- « drawn » est un abus de langage pour une ville, qu'on pose et qu'on ne
-- peint pas. Le mot est gardé parce que le parallèle avec les territoires
-- vaut mieux que l'exactitude du verbe : qui connaît `drawn_polities` sait
-- déjà lire tout ce qui suit.

create table public.drawn_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  name text not null,
  longitude double precision not null,
  latitude double precision not null,
  -- La fin est facultative, et son absence veut dire « toujours là » — la
  -- convention qu'OpenHistoricalMap emploie déjà dans `places`, où 16 502
  -- lieux sur 23 279 n'ont pas d'année de fin.
  start_year integer not null,
  end_year integer,
  shared boolean not null default true,
  origin_id uuid references public.drawn_places(id) on delete set null,
  stars integer not null default 0,
  created_at timestamptz not null default now(),
  constraint drawn_places_span check (end_year is null or end_year >= start_year),
  constraint drawn_places_named check (btrim(name) <> ''),
  constraint drawn_places_on_earth check (
    longitude between -180 and 180 and latitude between -90 and 90
  ),
  -- Une copie reste à celui qui l'a prise : on ne repartage pas le travail
  -- d'autrui sous son propre nom. Même règle que pour les territoires.
  constraint drawn_places_copies_stay_private check (origin_id is null or not shared)
);

alter table public.drawn_places enable row level security;

create policy "own drawn places" on public.drawn_places
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- La carte demande « qui existe en telle année », pour ce lecteur.
create index drawn_places_mine on public.drawn_places (user_id, start_year);
-- Le catalogue ne regarde que ce qui est partagé, et par étoiles.
create index drawn_places_shared on public.drawn_places (stars desc, id desc)
  where shared;

-- Les lieux de référence qu'un lecteur a ôtés de sa carte.
--
-- **Par `ohm_id`, et c'est le seul endroit où la ville ne copie pas le
-- territoire.** `hidden_polities` masque par nom, parce qu'une entité existe
-- en une dizaine de versions au fil des siècles et que personne ne veut en
-- masquer une seule. Un lieu n'a pas de versions, mais il a des homonymes :
-- 23 279 lignes pour 18 677 noms distincts. Masquer « Alexandrie » par le nom
-- en effacerait plusieurs d'un coup.
--
-- Et par `ohm_id` plutôt que par la clé primaire, parce que `places.id` est
-- un uuid attribué au chargement : recharger l'extrait d'OpenHistoricalMap le
-- changerait, et tous les masques tomberaient à côté. `ohm_id` est l'identité
-- du lieu chez lui — non nul et unique sur les 23 279 lignes, vérifié.
create table public.hidden_places (
  user_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  ohm_id bigint not null,
  hidden_at timestamptz not null default now(),
  primary key (user_id, ohm_id)
);

alter table public.hidden_places enable row level security;

create policy "own hidden places" on public.hidden_places
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());;
