-- Un troisième ordre pour le catalogue : le temps, du plus ancien au plus
-- récent.
--
-- Les trois portes classent toujours par `rank desc`, et la pagination à
-- curseur en dépend — c'est pourquoi l'ordre chronologique est obtenu en
-- niant la clé de date plutôt qu'en renversant le `order by` : le reste de
-- la fonction, curseur compris, continue de n'avoir qu'une seule règle.
--
-- Ce qui n'a pas de date part en dernier, par une sentinelle très basse :
-- un `rank` nul sortirait la ligne de la pagination elle-même, puisque la
-- comparaison `(rank, id) < (after_rank, after_id)` vaut NULL dès qu'un
-- membre est nul. Les événements en ont toujours une ; un personnage sans
-- naissance et un arbre vide, non.
--
-- La modification est faite par substitution dans la définition existante,
-- et non par une réécriture : ces fonctions font cent lignes chacune, dont
-- une seule change.
do $$
declare d text;
begin
  select pg_get_functiondef(p.oid) into strict d
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'search_events';

  d := replace(
    d,
    'when ''recent'' then extract(epoch from e.created_at)',
    'when ''oldest'' then coalesce((-e.from_key)::double precision, -1e15)
        when ''recent'' then extract(epoch from e.created_at)'
  );
  execute d;

  select pg_get_functiondef(p.oid) into strict d
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'search_characters';

  d := replace(
    d,
    'when ''recent'' then extract(epoch from c.created_at)',
    'when ''oldest'' then coalesce((-c.from_key)::double precision, -1e15)
        when ''recent'' then extract(epoch from c.created_at)'
  );
  execute d;

  -- L'arbre tient sa date de ses gens : `stands` en donne la naissance la
  -- plus ancienne, qui est aussi celle sur laquelle le filtre d'époque le
  -- retient déjà.
  select pg_get_functiondef(p.oid) into strict d
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'search_trees';

  d := replace(
    d,
    'when ''recent'' then extract(epoch from t.created_at)',
    'when ''oldest'' then coalesce((-s.from_key)::double precision, -1e15)
        when ''recent'' then extract(epoch from t.created_at)'
  );
  execute d;
end $$;;
