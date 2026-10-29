-- A star is a copy, and a copy is a fact.
--
-- Not a rating: nobody scores anybody's work here. The only honest signal a
-- catalogue like this has is "somebody found this worth taking", and it
-- cannot be gamed by opinion — only by copying, which costs something.
--
-- The row is kept even if the copy is later deleted. "This was useful to
-- someone once" stays true, and a counter that went down would invite
-- copy-then-delete to hurt a rival.
create table public.copies (
  kind text not null check (
    kind in ('event', 'folder', 'character', 'tree', 'territory')
  ),
  source_id uuid not null,
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (kind, source_id, user_id)
);

alter table public.copies enable row level security;

-- Readable so a card can say "déjà dans votre collection". Written only by
-- `copy_event` and its kin, which run as their owner.
create policy "on voit ce qu'on a copié"
  on public.copies for select
  to authenticated
  using (user_id = (select auth.uid()));

-- The count, kept beside the thing counted so a catalogue can be sorted by
-- it with an index rather than a join and a group by on every page.
alter table public.events add column stars integer not null default 0;
alter table public.folders add column stars integer not null default 0;
alter table public.characters add column stars integer not null default 0;
alter table public.trees add column stars integer not null default 0;
alter table public.drawn_polities add column stars integer not null default 0;

/**
 * Keeps the count and the copies from ever disagreeing.
 *
 * `security definer` because the row being counted belongs to somebody else —
 * the whole point — and no reader may write another reader's row. The trigger
 * touches one column of one row, named by the copy that fired it.
 */
create or replace function public.count_the_star()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
begin
  case new.kind
    when 'event' then
      update public.events set stars = stars + 1 where id = new.source_id;
    when 'folder' then
      update public.folders set stars = stars + 1 where id = new.source_id;
    when 'character' then
      update public.characters set stars = stars + 1 where id = new.source_id;
    when 'tree' then
      update public.trees set stars = stars + 1 where id = new.source_id;
    when 'territory' then
      update public.drawn_polities set stars = stars + 1 where id = new.source_id;
  end case;
  return new;
end;
$function$;

create trigger count_the_star_on_copy
  after insert on public.copies
  for each row execute function public.count_the_star();

-- What the catalogue is ordered by, and what it filters on.
create index events_shared_stars_idx on public.events (stars desc, id desc)
  where shared;
create index events_shared_recent_idx on public.events (created_at desc, id desc)
  where shared;;
