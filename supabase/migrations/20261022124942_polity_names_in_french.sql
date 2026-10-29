-- Le dictionnaire de la traduction, anglais vers français.
--
-- Une table et non une suite d'`update` : mille cinq cent quarante noms ne se
-- traduisent pas en une fois, et un chantier qu'on reprend demande un endroit
-- où lire ce qui est déjà fait. Elle sert aussi de preuve — on peut relire la
-- traduction ligne à ligne sans interroger la table qu'elle a modifiée.
--
-- `fr` est unique, et c'est la contrainte qui compte : le nom est la clé
-- primaire de `polity_wash`, donc deux noms anglais qui donneraient le même
-- français s'y écraseraient l'un l'autre. La base refusera la collision plutôt
-- que de perdre un lavis en silence.
create table if not exists public.polity_french (
  en text primary key,
  fr text not null unique,
  /** Ce qui a demandé un arbitrage : un nom douteux, un choix de forme. */
  note text
);

alter table public.polity_french enable row level security;;
