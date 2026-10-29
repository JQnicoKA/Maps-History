create or replace function public.judge(about text, which uuid, verdict text, became uuid default null::uuid, why text default null::text)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  me uuid := auth.uid();
  src record;
  entry uuid := became;
begin
  if not exists (
    select 1 from public.profiles p where p.user_id = me and p.library
  ) then
    raise exception 'Seule la bibliothèque juge.';
  end if;

  case about
    when 'event' then
      select e.user_id as who, e.shared as open, e.origin_id is not null as taken
        into src from public.events e where e.id = which;
    when 'character' then
      select c.user_id as who, c.shared as open, c.origin_id is not null as taken
        into src from public.characters c where c.id = which;
    when 'tree' then
      select t.user_id as who, t.shared as open, t.origin_id is not null as taken
        into src from public.trees t where t.id = which;
    when 'place', 'territory' then
      raise exception 'Une ville et un territoire se promeuvent : voir promote_place.';
    else
      -- Dont « folder » : un classeur n'est plus une ligne, c'est un nom
      -- écrit sur l'événement, et il entre dans la bibliothèque avec lui.
      raise exception 'Genre inconnu : %', about;
  end case;
  if src.who is null then
    raise exception 'Cette proposition n''existe plus.';
  end if;
  if src.who = me then
    raise exception 'La bibliothèque n''a pas à se relire.';
  end if;

  if verdict = 'admitted' then
    if not src.open then
      raise exception 'Son auteur ne l''ouvre pas à la bibliothèque.';
    end if;
    if src.taken then
      raise exception 'C''est une copie : la bibliothèque tient déjà l''entrée dont elle vient.';
    end if;

    if entry is null then
      case about
        when 'event' then entry := public.copy_one_event(which, me);
        when 'character' then entry := public.copy_one_character(which, me);
        else
          raise exception
            'Les arbres n''entrent pas encore dans la bibliothèque. Mettez celui-ci de côté.';
      end case;
      if entry is null then
        raise exception 'La reprise n''a rien produit.';
      end if;
    end if;

    case about
      when 'event' then
        update public.events set published = true, origin_id = null
         where id = entry and user_id = me;
      when 'character' then
        update public.characters set published = true, origin_id = null
         where id = entry and user_id = me;
      when 'tree' then
        update public.trees set published = true, origin_id = null
         where id = entry and user_id = me;
    end case;
    if not found then
      raise exception 'Cette entrée n''est pas la vôtre.';
    end if;

    delete from public.copies k
     where k.kind = about and k.source_id = which and k.user_id = me;
  end if;

  insert into public.review (kind, source_id, state, became, note, who)
  values (about, which, verdict, entry, nullif(btrim(why), ''), src.who)
  on conflict (kind, source_id) do update
    set state = excluded.state,
        became = excluded.became,
        note = excluded.note,
        who = excluded.who,
        at = now();

  return entry;
end;
$function$;;
