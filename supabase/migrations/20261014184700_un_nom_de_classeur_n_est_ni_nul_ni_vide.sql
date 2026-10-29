alter table public.events
  add constraint events_folders_named check (
    array_position(folders, null) is null
    and array_position(folders, '') is null
  );;
