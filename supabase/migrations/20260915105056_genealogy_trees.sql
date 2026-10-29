-- Les arbres généalogiques : une mise en scène des personnages, pas une
-- propriété des personnages eux-mêmes.
--
-- Le même individu peut figurer dans plusieurs arbres, et n'y porter ni la même
-- importance ni la même note : ce qu'on dit de Louis XIV dans l'arbre des
-- Bourbons n'est pas ce qu'on en dit dans celui des Habsbourg. Tout ce qui est
-- propre à une place dans un arbre vit donc sur le membre, jamais sur la
-- personne.
create table if not exists public.trees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  note text,
  created_at timestamptz not null default now(),
  constraint trees_name_check check (length(btrim(name)) > 0)
);

create table if not exists public.tree_members (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references public.trees (id) on delete cascade,
  character_id uuid not null references public.characters (id) on delete cascade,
  /** Rang de la génération, 0 en haut. */
  generation integer not null default 0,
  /** Rang dans sa génération, de gauche à droite. */
  position integer not null default 0,
  importance text not null default 'medium'
    check (importance in ('high', 'medium', 'low')),
  /** Emoji d'une fin précoce : maladie, poison, assassinat… */
  mark text,
  note text,

  -- Une personne ne tient qu'une place dans un arbre donné.
  unique (tree_id, character_id)
);

create index if not exists tree_members_tree_idx
  on public.tree_members (tree_id, generation, position);

create table if not exists public.tree_links (
  tree_id uuid not null references public.trees (id) on delete cascade,
  parent_id uuid not null references public.tree_members (id) on delete cascade,
  child_id uuid not null references public.tree_members (id) on delete cascade,
  primary key (parent_id, child_id),
  -- Un trait ne relie pas quelqu'un à lui-même.
  constraint no_self_link check (parent_id <> child_id)
);

create index if not exists tree_links_tree_idx on public.tree_links (tree_id);

alter table public.trees enable row level security;
alter table public.tree_members enable row level security;
alter table public.tree_links enable row level security;

create policy "prototype open access" on public.trees
  for all to anon, authenticated using (true) with check (true);
create policy "prototype open access" on public.tree_members
  for all to anon, authenticated using (true) with check (true);
create policy "prototype open access" on public.tree_links
  for all to anon, authenticated using (true) with check (true);;
