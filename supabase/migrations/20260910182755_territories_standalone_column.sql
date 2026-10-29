-- Un fief « autonome » est un fief qu'aucune entité souveraine ne recouvre à son
-- époque : le duché de Bar en 1453, quand il n'existe ni royaume de France ni
-- Saint-Empire chez OHM. Ceux-là sont le rang politique le plus haut de leur
-- coin de carte et doivent se voir à tous les zooms, sans quoi l'Europe est
-- vide. Les autres — un Land allemand en l'an 2000 — restent réservés au zoom
-- pays, sinon le monde moderne part en confettis.
alter table public.territories
  add column if not exists standalone boolean not null default false;

create index if not exists territories_visible_idx
  on public.territories (admin_level, standalone);;
