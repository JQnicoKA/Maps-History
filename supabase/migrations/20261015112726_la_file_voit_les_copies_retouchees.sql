-- La file montre deux choses, et le dit.
--
-- Une **proposition** : un original sans verdict, qui peut entrer dans la
-- bibliothèque. Une **suggestion** : une copie que son preneur a retouchée
-- depuis qu'il l'a prise, et qui ne peut pas entrer — ce serait un doublon de
-- l'entrée dont elle vient — mais dont cette entrée-là gagnerait à profiter.
--
-- `origin` est ce qui les sépare : nul pour une proposition, l'identifiant de
-- l'entrée à corriger pour une suggestion. Sans cette colonne, le conservateur
-- appellerait `judge` sur une copie et se ferait refuser sans comprendre.
--
-- Trois conditions pour qu'une copie se montre, et chacune compte :
--   `shared`        — son preneur l'autorise ; c'est tout l'objet du virage.
--   `taken_at`      — on sait depuis quand comparer.
--   `updated_at >`  — elle a bougé depuis. Une copie intacte n'a rien à dire,
--                     et c'est ce qui faisait neuf lignes sur dix autrefois.
drop function if exists public.to_review(text, integer);

create function public.to_review(want text default null, page_size integer default 50)
 returns table(
   kind text, id uuid, title text, who text,
   made timestamptz, usable boolean, origin uuid
 )
 language plpgsql
 stable security definer
 set search_path to ''
as $function$
begin
  if not exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.library
  ) then
    raise exception 'Cette file n''est ouverte qu''à la bibliothèque.';
  end if;

  return query
  with tout as (
    -- Les propositions. `made` est leur naissance.
    select 'event'::text as kind, e.id, e.title, e.user_id,
           e.created_at as made, e.shared, null::uuid as origin
    from public.events e where not e.published and e.origin_id is null
    union all
    select 'character', c.id, c.name, c.user_id, c.created_at, c.shared, null::uuid
    from public.characters c where not c.published and c.origin_id is null
    union all
    select 'tree', t.id, t.name, t.user_id, t.created_at, t.shared, null::uuid
    from public.trees t where not t.published and t.origin_id is null
    union all
    -- Les villes et les territoires n'ont pas d'`origin_id` : ils ne se
    -- copient pas, ils se promeuvent. Toute ligne est donc un original.
    select 'territory', d.id, d.name, d.user_id, d.created_at, d.shared, null::uuid
    from public.drawn_polities d
    union all
    select 'place', d.id, d.name, d.user_id, d.created_at, d.shared, null::uuid
    from public.drawn_places d

    union all

    -- Les suggestions. `made` est leur dernière retouche, pas leur naissance :
    -- c'est le moment où elles ont eu quelque chose à dire, et c'est sur lui
    -- que la file trie et que le balayage se compare.
    select 'event', e.id, e.title, e.user_id, e.updated_at, e.shared, e.origin_id
    from public.events e
    where e.origin_id is not null and e.shared
      and e.taken_at is not null and e.updated_at > e.taken_at
    union all
    select 'character', c.id, c.name, c.user_id, c.updated_at, c.shared, c.origin_id
    from public.characters c
    where c.origin_id is not null and c.shared
      and c.taken_at is not null and c.updated_at > c.taken_at
  )
  select q.kind, q.id, q.title, pr.handle, q.made, q.shared, q.origin
  from tout q
  join public.profiles pr on pr.user_id = q.user_id
  where (want is null or q.kind = want)
    -- Jamais ses propres lignes : la bibliothèque n'a pas à se relire.
    and not pr.library
    and not exists (
      select 1 from public.review r
      where r.kind = q.kind and r.source_id = q.id
    )
    -- Balayée, et seulement jusqu'à sa prochaine retouche. Comparée et non
    -- constatée : c'est tout l'intérêt de garder le balayage daté.
    and q.made > coalesce((
      select d.at from public.dismissed d
      where d.user_id = auth.uid() and d.sort = 'suggestion'
        and d.kind = q.kind and d.source_id = q.id
    ), '-infinity'::timestamptz)
  order by q.made desc
  limit least(greatest(coalesce(page_size, 50), 1), 500);
end;
$function$;

revoke execute on function public.to_review(text, integer) from public, anon;
grant execute on function public.to_review(text, integer) to authenticated;;
