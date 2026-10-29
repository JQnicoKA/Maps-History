drop function if exists public.judge(text, uuid, text, uuid, text);

-- Juger une proposition, et l'admettre d'un seul geste.
--
-- `became` n'était pas fournissable. Les quatre `copy_*` exigent
-- `and x.published`, qu'une proposition n'a par définition pas, et aucune
-- autre route ne menait d'une ligne en attente à un exemplaire dans le compte
-- de la bibliothèque. Les ouvriers de la copie — `copy_one_event`,
-- `copy_one_character` — ne demandent rien, eux : ils recopient la ligne, ses
-- photographies et sa distribution. Ce sont eux que l'on appelle.
--
-- `became` reste accepté, pour le seul cas qui le mérite : fondre la
-- proposition dans une entrée que la bibliothèque tient déjà.
create function public.judge(
  about text,
  which uuid,
  verdict text,
  became uuid default null,
  why text default null
) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  author uuid;
  entry uuid := became;
begin
  if not exists (
    select 1 from public.profiles p where p.user_id = me and p.library
  ) then
    raise exception 'Seule la bibliothèque juge.';
  end if;

  -- Qui l'a proposée — et, du même coup, existe-t-elle encore ?
  case about
    when 'event' then
      select e.user_id into author from public.events e where e.id = which;
    when 'character' then
      select c.user_id into author from public.characters c where c.id = which;
    when 'folder' then
      select f.user_id into author from public.folders f where f.id = which;
    when 'tree' then
      select t.user_id into author from public.trees t where t.id = which;
    else
      raise exception 'Une ville et un territoire se promeuvent : voir promote_place.';
  end case;
  if author is null then
    raise exception 'Cette proposition n''existe plus.';
  end if;
  if author = me then
    raise exception 'La bibliothèque n''a pas à se relire.';
  end if;

  if verdict = 'admitted' and entry is null then
    case about
      when 'event' then entry := public.copy_one_event(which, me);
      when 'character' then entry := public.copy_one_character(which, me);
      else
        -- Reporté avec le reste : la copie d'un classeur ne reprend que les
        -- événements déjà publiés, et ceux d'une proposition ne le sont pas.
        -- Elle produirait un classeur vide, ce qui est pire que refuser.
        raise exception
          'Les classeurs et les arbres n''entrent pas encore dans la bibliothèque. Mettez celui-ci de côté.';
    end case;
    if entry is null then
      raise exception 'La reprise n''a rien produit.';
    end if;
  end if;

  if verdict = 'admitted' then
    case about
      when 'event' then
        update public.events set published = true, origin_id = null
         where id = entry and user_id = me;
      when 'character' then
        update public.characters set published = true, origin_id = null
         where id = entry and user_id = me;
      when 'folder' then
        update public.folders set published = true, origin_id = null
         where id = entry and user_id = me;
      when 'tree' then
        update public.trees set published = true, origin_id = null
         where id = entry and user_id = me;
    end case;
    if not found then
      raise exception 'Cette entrée n''est pas la vôtre.';
    end if;

    -- L'exemplaire est devenu une entrée. `origin_id` coupé, cette ligne de
    -- `copies` prétendrait que la bibliothèque détient une copie de la ligne
    -- de son auteur — c'est `review` qui garde ce lien, désormais, et lui
    -- seul.
    delete from public.copies k
     where k.kind = about and k.source_id = which and k.user_id = me;
  end if;

  insert into public.review (kind, source_id, state, became, note, who)
  values (about, which, verdict, entry, nullif(btrim(why), ''), author)
  on conflict (kind, source_id) do update
    set state = excluded.state,
        became = excluded.became,
        note = excluded.note,
        who = excluded.who,
        at = now();

  return entry;
end;
$$;

revoke execute on function public.judge(text, uuid, text, uuid, text)
  from public, anon;
grant execute on function public.judge(text, uuid, text, uuid, text)
  to authenticated;;
