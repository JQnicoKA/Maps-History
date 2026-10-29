-- `stars` ne doit pas faire vieillir une entrée.
--
-- `count_the_star` incrémente `stars` sur la ligne copiée, ce qui est un
-- `update` comme un autre : `touch_updated_at` poussait donc `updated_at`
-- à chaque exemplaire pris. Et `stale()` compare exactement cette date au
-- `taken_at` des détenteurs — de sorte qu'un lecteur qui copiait Marignan
-- annonçait « une nouvelle version existe » à tous ceux qui le tenaient déjà,
-- pour un compteur de popularité dont aucun d'eux ne voit la valeur.
--
-- Vu seulement aujourd'hui, et par accident : hier j'ai prouvé la chaîne de
-- mise à jour en corrigeant du texte, jamais en regardant quelqu'un copier.
-- La notification, elle, l'a montré tout de suite.
--
-- Comparaison générique plutôt qu'une exception nommée dans
-- `count_the_star` : ce qui compte n'est pas qui écrit, c'est que la seule
-- différence entre les deux versions de la ligne soit ce compteur.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if to_jsonb(new) - 'stars' - 'updated_at'
     = to_jsonb(old) - 'stars' - 'updated_at' then
    new.updated_at = old.updated_at;
    return new;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.touch_updated_at() from public, anon;;
