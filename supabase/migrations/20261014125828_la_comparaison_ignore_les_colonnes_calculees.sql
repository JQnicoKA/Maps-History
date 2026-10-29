-- Deuxième essai, et la raison du premier échec vaut d'être écrite.
--
-- Comparer `to_jsonb(new)` à `to_jsonb(old)` ne marche pas tel quel sur ces
-- tables : `events` porte trois colonnes générées — `spot`, `from_key`,
-- `to_key` — et PostgreSQL ne les calcule qu'après les déclencheurs BEFORE.
-- Elles sont donc nulles dans NEW et pleines dans OLD, la comparaison trouve
-- trois différences à chaque `update`, et elle est toujours fausse. Le
-- compteur de copies continuait tranquillement à faire vieillir l'entrée.
--
-- La liste des colonnes à ignorer est donc lue dans le catalogue, pour la
-- table que le déclencheur sert : les quatre tables n'ont pas les mêmes.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  ignored text[];
begin
  select coalesce(array_agg(a.attname), '{}')
    into ignored
    from pg_catalog.pg_attribute a
   where a.attrelid = tg_relid
     and a.attgenerated <> ''
     and not a.attisdropped;

  -- `stars` n'est pas une correction : il bouge quand un lecteur prend un
  -- exemplaire, ce qui ne change rien à ce que l'entrée dit.
  ignored := ignored || array['stars', 'updated_at'];

  if to_jsonb(new) - ignored = to_jsonb(old) - ignored then
    new.updated_at = old.updated_at;
    return new;
  end if;

  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.touch_updated_at() from public, anon;;
