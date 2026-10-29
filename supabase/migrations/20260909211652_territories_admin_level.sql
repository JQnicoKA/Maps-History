alter table public.territory_fragments
  add column if not exists admin_level smallint;

alter table public.territories
  add column if not exists admin_level smallint not null default 2;

-- Les souverains d'abord : la carte les dessine à tous les zooms, les fiefs
-- seulement à partir du zoom pays.
create index if not exists territories_admin_level_idx
  on public.territories (admin_level);;
