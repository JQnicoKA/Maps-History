-- `updated_at` répond à une seule question : « ce que cette ligne dit a-t-il
-- changé ? » Tout le reste est de la comptabilité, et chaque fois qu'elle a
-- bougé `updated_at` avec elle, quelqu'un s'est fait mentir :
--
--   `stars`     un lecteur prend une copie, et tous les autres détenteurs
--               s'entendent dire qu'une nouvelle version existe.
--   `origin_id` `attach` rattache une ligne, et son auteur est aussitôt
--   `taken_at`  signalé comme l'ayant modifiée — `touched` décide du ton de
--               l'avertissement, et il annonçait une perte imaginaire.
--   `shared`    décocher sa case n'est pas corriger son texte.
--   `published` `judge` publie, sur une ligne insérée la seconde d'avant.
--
-- Les colonnes générées s'ajoutent à la liste parce qu'elles sont nulles dans
-- NEW — PostgreSQL les calcule après les déclencheurs BEFORE — et qu'elles
-- rendraient la comparaison toujours fausse.
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

  ignored := ignored || array[
    'updated_at', 'stars', 'origin_id', 'taken_at', 'shared', 'published'
  ];

  if to_jsonb(new) - ignored = to_jsonb(old) - ignored then
    new.updated_at = old.updated_at;
    return new;
  end if;

  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.touch_updated_at() from public, anon;;
