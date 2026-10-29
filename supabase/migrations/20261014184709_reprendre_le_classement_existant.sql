update public.events e set
  folders = coalesce((
    select array_agg(distinct f.name)
      from public.event_folders ef
      join public.folders f on f.id = ef.folder_id
     where ef.event_id = e.id
  ), '{}'),
  importance = coalesce((
    select max(ef.importance)
      from public.event_folders ef
     where ef.event_id = e.id
  ), 'medium')
where exists (
  select 1 from public.event_folders ef where ef.event_id = e.id
);;
