-- La seule chose qu'il faut stocker des notifications : celles qu'on balaie.
--
-- Les notifications elles-mêmes ne sont pas une table. « Votre X est entré
-- dans la bibliothèque » se lit dans `review`, « votre exemplaire a pris du
-- retard » se déduit des dates : les deux sont déjà en base. Une table de
-- notifications voudrait dire une ligne par détenteur à chaque correction, et
-- elle mentirait le jour où quelqu'un se met à jour depuis le formulaire,
-- puisque rien n'irait l'effacer. Calculées, elles s'effacent d'elles-mêmes.
--
-- `sort` entre dans la clé, et ce n'est pas un détail : une ligne rattachée
-- porte d'abord « votre événement est entré », puis plus tard « une nouvelle
-- version existe », avec la même clé `(kind, source_id)`. Sans `sort`, avoir
-- balayé la première aurait étouffé toutes les secondes.
create table if not exists public.dismissed (
  user_id uuid not null references auth.users(id) on delete cascade,
  sort text not null,
  kind text not null,
  source_id uuid not null,
  at timestamptz not null default now(),
  primary key (user_id, sort, kind, source_id),
  constraint dismissed_sort check (sort in ('admitted', 'promoted', 'stale')),
  constraint dismissed_kind check (
    kind in ('event', 'character', 'folder', 'tree', 'territory', 'place')
  )
);

comment on table public.dismissed is
  'Les notifications que ce lecteur a balayées. Pour « stale », la date compte : une correction postérieure la ramène.';

alter table public.dismissed enable row level security;

create policy "own dismissals" on public.dismissed
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());;
