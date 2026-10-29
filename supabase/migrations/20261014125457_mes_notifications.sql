-- Tout ce que ce lecteur n'a pas encore lu, en une requête.
--
-- Trois genres, et ils ne demandent pas la même chose :
--
--   `admitted` — sa proposition est entrée dans la bibliothèque. On lui offre
--     de rattacher sa ligne, ce qui lui ouvrira les mises à jour. Disparaît
--     d'elle-même le jour où il rattache, puisque la condition tombe.
--   `promoted` — sa ville ou son territoire est passé dans le fond de carte.
--     Rien à rattacher : tout le monde l'a déjà. Mais sa ligne a été
--     supprimée, et le silence sur un dessin qui s'évapore est inquiétant.
--   `stale` — la bibliothèque a corrigé une entrée dont il tient un
--     exemplaire. C'était jusqu'ici invisible : `UpdateRow` ne s'affiche
--     qu'en tête du formulaire de modification, et personne n'ouvre un
--     formulaire de modification pour voir si quelque chose a changé.
--
-- `security definer` pour lire `review`, réservée à la bibliothèque, et les
-- entrées publiées dont le lecteur n'a pas de copie.
create or replace function public.my_notices()
returns table (
  sort text,
  kind text,
  source_id uuid,
  entry_id uuid,
  title text,
  touched boolean,
  attachable boolean,
  at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  -- Admise : l'entrée publiée existe, sa ligne n'y est pas encore rattachée.
  select 'admitted'::text, 'event'::text, r.source_id, r.became, entry.title,
         false, mine.id is not null, r.at
    from public.review r
    join public.events entry on entry.id = r.became and entry.published
    left join public.events mine
      on mine.id = r.source_id and mine.user_id = auth.uid()
   where r.kind = 'event' and r.state = 'admitted' and r.who = auth.uid()
     and (mine.id is null or mine.origin_id is distinct from r.became)
     and not exists (
       select 1 from public.dismissed d
        where d.user_id = auth.uid() and d.sort = 'admitted'
          and d.kind = 'event' and d.source_id = r.source_id
     )

  union all

  select 'admitted', 'character', r.source_id, r.became, entry.name,
         false, mine.id is not null, r.at
    from public.review r
    join public.characters entry on entry.id = r.became and entry.published
    left join public.characters mine
      on mine.id = r.source_id and mine.user_id = auth.uid()
   where r.kind = 'character' and r.state = 'admitted' and r.who = auth.uid()
     and (mine.id is null or mine.origin_id is distinct from r.became)
     and not exists (
       select 1 from public.dismissed d
        where d.user_id = auth.uid() and d.sort = 'admitted'
          and d.kind = 'character' and d.source_id = r.source_id
     )

  union all

  -- Promue : la ligne de l'auteur n'existe plus, le nom vient du fond.
  select 'promoted', 'place', r.source_id, r.became, p.name, false, false, r.at
    from public.review r
    join public.places p on p.id = r.became
   where r.kind = 'place' and r.state = 'admitted' and r.who = auth.uid()
     and not exists (
       select 1 from public.dismissed d
        where d.user_id = auth.uid() and d.sort = 'promoted'
          and d.kind = 'place' and d.source_id = r.source_id
     )

  union all

  select 'promoted', 'territory', r.source_id, r.became, po.name, false, false, r.at
    from public.review r
    join public.polities po on po.id = r.became
   where r.kind = 'territory' and r.state = 'admitted' and r.who = auth.uid()
     and not exists (
       select 1 from public.dismissed d
        where d.user_id = auth.uid() and d.sort = 'promoted'
          and d.kind = 'territory' and d.source_id = r.source_id
     )

  union all

  -- En retard : la même question que `stale()`, plus la date du balayage.
  -- Comparée et non pas constatée : une correction postérieure au balayage
  -- ramène la notification, ce qui est tout l'intérêt de la garder datée.
  select 'stale', 'event', mine.id, entry.id, mine.title,
         mine.updated_at > mine.taken_at, false, entry.updated_at
    from public.events mine
    join public.events entry
      on entry.id = mine.origin_id and entry.published
   where mine.user_id = auth.uid()
     and mine.taken_at is not null
     and entry.updated_at > mine.taken_at
     and entry.updated_at > coalesce((
       select d.at from public.dismissed d
        where d.user_id = auth.uid() and d.sort = 'stale'
          and d.kind = 'event' and d.source_id = mine.id
     ), '-infinity'::timestamptz)

  union all

  select 'stale', 'character', mine.id, entry.id, mine.name,
         mine.updated_at > mine.taken_at, false, entry.updated_at
    from public.characters mine
    join public.characters entry
      on entry.id = mine.origin_id and entry.published
   where mine.user_id = auth.uid()
     and mine.taken_at is not null
     and entry.updated_at > mine.taken_at
     and entry.updated_at > coalesce((
       select d.at from public.dismissed d
        where d.user_id = auth.uid() and d.sort = 'stale'
          and d.kind = 'character' and d.source_id = mine.id
     ), '-infinity'::timestamptz)

  order by 8 desc;
$$;

revoke execute on function public.my_notices() from public, anon;
grant execute on function public.my_notices() to authenticated;;
