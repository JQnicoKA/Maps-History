-- Le carnet du conservateur.
--
-- Avec le partage ouvert par défaut, la file d'attente n'est pas un petit tas
-- de propositions : **c'est la base entière**, tout ce qui a jamais été créé.
-- Sans mémoire de ce qui a été lu, on relirait les mêmes deux mille lignes à
-- chaque séance. Voilà cette mémoire.
--
-- Une table à part et non une colonne sur chaque table de contenu : c'est la
-- donnée du conservateur, pas celle de l'auteur. La politique est donc simple
-- — lui seul la voit — et les tables de contenu restent propres.
--
-- Pas de ligne = pas encore lu. La table ne porte que les verdicts rendus,
-- ce qui la garde petite et évite d'avoir à semer un état « non lu » sur
-- chaque élément créé.
create table public.review (
  kind text not null,
  source_id uuid not null,
  state text not null,
  -- L'entrée de la bibliothèque que cet élément est devenu, s'il en est
  -- devenu une. C'est ici que vit le lien auteur → entrée, et nulle part
  -- ailleurs : `origin_id` ne peut pas s'en charger, il tombe le jour où
  -- l'auteur supprime sa ligne ou son compte, et l'entrée doit lui survivre.
  became uuid,
  note text,
  at timestamptz not null default now(),
  primary key (kind, source_id),
  constraint review_kind check (
    kind = any (array['event', 'character', 'folder', 'tree', 'territory', 'place'])
  ),
  constraint review_state check (
    state = any (array['admitted', 'aside', 'rejected'])
  )
);

alter table public.review enable row level security;

create policy "the library reviews" on public.review
  for all using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.library
    )
  ) with check (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.library
    )
  );

/**
 * Ce qui n'a pas encore été lu, le plus récent d'abord.
 *
 * Tous les genres dans une seule requête, parce que c'est ainsi qu'on trie :
 * on ouvre la file et on prend ce qui vient. `want` la restreint à un genre
 * quand on veut faire une passe sur les événements seuls.
 *
 * Le pseudonyme accompagne chaque ligne — non pour l'afficher à qui que ce
 * soit, mais parce que « ces quarante-trois viennent du même compte » est le
 * signal le plus utile de la file, et qu'un uuid ne se lit pas.
 *
 * `security definer`, donc elle voit ce que les autres comptes ont écrit — et
 * refuse de s'ouvrir à quiconque n'est pas la bibliothèque. C'est la seule
 * porte de l'application qui regarde par-dessus l'épaule des gens, alors
 * elle le dit et elle le vérifie.
 */
create or replace function public.to_review(
  want text default null,
  page_size integer default 50
) returns table (
  kind text,
  id uuid,
  title text,
  who text,
  made timestamptz,
  usable boolean
)
language plpgsql stable security definer
set search_path to ''
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.library
  ) then
    raise exception 'Cette file n''est ouverte qu''à la bibliothèque.';
  end if;

  return query
  with tout as (
    select 'event'::text as kind, e.id, e.title, e.user_id, e.created_at, e.shared
    from public.events e where not e.published
    union all
    select 'character', c.id, c.name, c.user_id, c.created_at, c.shared
    from public.characters c where not c.published
    union all
    select 'folder', f.id, f.name, f.user_id, f.created_at, f.shared
    from public.folders f where not f.published
    union all
    select 'tree', t.id, t.name, t.user_id, t.created_at, t.shared
    from public.trees t where not t.published
    union all
    select 'territory', d.id, d.name, d.user_id, d.created_at, d.shared
    from public.drawn_polities d
    union all
    select 'place', d.id, d.name, d.user_id, d.created_at, d.shared
    from public.drawn_places d
  )
  select
    q.kind, q.id, q.title, pr.handle, q.created_at, q.shared
  from tout q
  join public.profiles pr on pr.user_id = q.user_id
  where (want is null or q.kind = want)
    -- Jamais ses propres lignes : la bibliothèque n'a pas à se relire.
    and not pr.library
    and not exists (
      select 1 from public.review r
      where r.kind = q.kind and r.source_id = q.id
    )
  order by q.created_at desc
  limit least(greatest(coalesce(page_size, 50), 1), 500);
end;
$$;

/**
 * Rend un verdict, et publie du même geste quand il y a quelque chose à
 * publier.
 *
 * `became` est la ligne que le conservateur a copiée puis corrigée dans son
 * propre compte. L'admettre fait trois choses : noter le verdict, publier
 * cette ligne, et **couper son `origin_id`**. Ce dernier point compte : sans
 * lui l'entrée de la bibliothèque passerait pour une copie, et la mécanique
 * de mise à jour la prendrait pour quelque chose à rafraîchir depuis la ligne
 * privée d'un lecteur. La filiation qui compte est consignée dans `became`.
 */
create or replace function public.judge(
  about text,
  which uuid,
  verdict text,
  became uuid default null,
  why text default null
) returns void
language plpgsql security definer
set search_path to ''
as $$
declare
  me uuid := auth.uid();
begin
  if not exists (
    select 1 from public.profiles p where p.user_id = me and p.library
  ) then
    raise exception 'Seule la bibliothèque juge.';
  end if;

  insert into public.review (kind, source_id, state, became, note)
  values (about, which, verdict, became, nullif(btrim(why), ''))
  on conflict (kind, source_id) do update
    set state = excluded.state,
        became = excluded.became,
        note = excluded.note,
        at = now();

  if verdict = 'admitted' and became is not null then
    case about
      when 'event' then
        update public.events set published = true, origin_id = null
        where id = became and user_id = me;
      when 'character' then
        update public.characters set published = true, origin_id = null
        where id = became and user_id = me;
      when 'folder' then
        update public.folders set published = true, origin_id = null
        where id = became and user_id = me;
      when 'tree' then
        update public.trees set published = true, origin_id = null
        where id = became and user_id = me;
      else
        -- Les territoires et les villes ne se publient pas : ils se
        -- promeuvent dans le fond de carte. Voir `promote_place`.
        null;
    end case;
  end if;
end;
$$;

revoke execute on function public.to_review(text, integer) from public, anon;
revoke execute on function public.judge(text, uuid, text, uuid, text) from public, anon;;
