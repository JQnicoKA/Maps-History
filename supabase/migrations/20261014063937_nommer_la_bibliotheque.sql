-- La bibliothèque est un compte.
--
-- C'est tout le virage, et il tient en une colonne. Jusqu'ici la communauté
-- était « ce que chacun a bien voulu partager » — d'où la jungle : trois
-- Carthage, quatre Clovis, et personne pour trancher. Désormais elle est
-- « ce qu'un conservateur a relu et publié », et le conservateur est un
-- compte comme un autre, qui travaille avec l'application comme tout le
-- monde : il copie une proposition, la corrige, la publie.
--
-- Rien d'autre à construire pour ça. La copie existe, les formulaires
-- existent. Ce qui manquait, c'était de savoir qui est la bibliothèque.
alter table public.profiles
  add column library boolean not null default false;

comment on column public.profiles.library is
  'Vrai sur le compte dont les éléments publiés forment la bibliothèque. Un seul.';

-- Un seul compte peut l'être. Sans ceci, deux bibliothèques se mêleraient
-- dans le catalogue sans que rien ne le signale.
create unique index profiles_one_library on public.profiles (library)
  where library;

update public.profiles set library = true
  where user_id = 'c91e5ef6-0c36-427d-a01c-66f5860a186c';

-- Publié, et non plus partagé.
--
-- Deux colonnes et non une, alors qu'on aurait pu faire dire « publié » à
-- `shared` sur le compte bibliothèque : une colonne dont le sens dépend du
-- propriétaire de la ligne est une journée perdue dans six mois. Et séparées,
-- elles offrent le brouillon — une entrée en cours de rédaction, invisible
-- jusqu'à ce qu'elle soit prête.
--
-- `shared` garde son nom pour l'instant : vingt-six fonctions le lisent, dont
-- huit que la suite du chantier supprime. On le renommera à la fin, quand il
-- en restera la moitié. Ce qu'il veut dire désormais est écrit ci-dessous.
alter table public.events add column published boolean not null default false;
alter table public.characters add column published boolean not null default false;
alter table public.folders add column published boolean not null default false;
alter table public.trees add column published boolean not null default false;

comment on column public.events.published is
  'Dans la bibliothèque. N''a de sens que sur le compte bibliothèque.';
comment on column public.characters.published is
  'Dans la bibliothèque. N''a de sens que sur le compte bibliothèque.';
comment on column public.folders.published is
  'Dans la bibliothèque. N''a de sens que sur le compte bibliothèque.';
comment on column public.trees.published is
  'Dans la bibliothèque. N''a de sens que sur le compte bibliothèque.';

comment on column public.events.shared is
  'L''auteur autorise la bibliothèque à s''en servir. Ne rend rien visible à personne.';
comment on column public.characters.shared is
  'L''auteur autorise la bibliothèque à s''en servir. Ne rend rien visible à personne.';
comment on column public.folders.shared is
  'L''auteur autorise la bibliothèque à s''en servir. Ne rend rien visible à personne.';
comment on column public.trees.shared is
  'L''auteur autorise la bibliothèque à s''en servir. Ne rend rien visible à personne.';

-- Ce qui était déjà partagé par la bibliothèque y entre tel quel : elle a
-- tout écrit. Les quarante événements, les neuf personnages, les trois
-- classeurs et l'arbre passent publiés d'un coup — les classeurs et l'arbre
-- aussi, même si leurs portes resteront fermées jusqu'à ce que le corpus
-- mérite qu'on les compose.
update public.events e set published = true
  where e.shared and exists (
    select 1 from public.profiles p where p.user_id = e.user_id and p.library
  );
update public.characters c set published = true
  where c.shared and exists (
    select 1 from public.profiles p where p.user_id = c.user_id and p.library
  );
update public.folders f set published = true
  where f.shared and exists (
    select 1 from public.profiles p where p.user_id = f.user_id and p.library
  );
update public.trees t set published = true
  where t.shared and exists (
    select 1 from public.profiles p where p.user_id = t.user_id and p.library
  );

-- Le catalogue ne lira plus que ça : à indexer comme tel.
create index events_published on public.events (id) where published;
create index characters_published on public.characters (id) where published;
create index folders_published on public.folders (id) where published;
create index trees_published on public.trees (id) where published;;
