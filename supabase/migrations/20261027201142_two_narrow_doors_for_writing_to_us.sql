-- Écrire aux conservateurs, et savoir si le courriel est parti.
--
-- Deux portes étroites plutôt qu'une clé qui ouvre tout. La fonction de bord
-- `contact` agit avec le jeton de son appelant, comme `copy` : elle n'a pas la
-- clé `service_role`, et ne peut donc rien faire d'autre que ce que ces deux
-- fonctions autorisent. Tout ce qu'il y a à vérifier est vérifié ici, par
-- Postgres, et non dans un script qu'on pourrait oublier de relire.

/**
 * Dépose un message et le rend tel qu'il a été enregistré.
 *
 * Trois choses que seule la base peut garantir :
 *
 *   - **L'adresse n'est pas fournie par l'appelant**, elle est lue dans
 *     `auth.users`. Un client qui la donnerait pourrait faire répondre à
 *     quelqu'un d'autre.
 *   - **La cadence est bornée** : cinq messages par heure. Sans cela le bouton
 *     « Envoyer » est un canon à courrier, et c'est le genre de limite qui ne
 *     tient que si elle est du côté qui compte les lignes.
 *   - **La longueur est bornée** par la contrainte de la table, donc un corps
 *     vide ou un roman sont refusés avant d'être écrits.
 */
create or replace function public.write_to_us(body text)
returns table(id uuid, email text, said text, at timestamptz)
language plpgsql
security definer
set search_path to ''
as $$
declare
  moi uuid := auth.uid();
  mon_adresse text;
  recents int;
begin
  if moi is null then
    raise exception 'Il faut être connecté pour nous écrire.';
  end if;

  select u.email into mon_adresse from auth.users u where u.id = moi;
  if mon_adresse is null then
    raise exception 'Ce compte n''a pas d''adresse à laquelle répondre.';
  end if;

  select count(*) into recents
  from public.contact_messages m
  where m.user_id = moi and m.created_at > now() - interval '1 hour';

  if recents >= 5 then
    raise exception 'Vous nous avez déjà écrit cinq fois dans l''heure. Laissez-nous le temps de vous répondre.';
  end if;

  return query
  insert into public.contact_messages (user_id, email, body)
  values (moi, mon_adresse, btrim(body))
  returning
    contact_messages.id,
    contact_messages.email,
    contact_messages.body,
    contact_messages.created_at;
end;
$$;

revoke all on function public.write_to_us(text) from public, anon;
grant execute on function public.write_to_us(text) to authenticated, service_role;

/**
 * Note qu'un message est parti, ou pourquoi il ne l'est pas.
 *
 * Son seul office est la comptabilité : un message dont le courriel a échoué
 * reste lisible dans la table, avec sa raison. Mentir ici ne donne accès à
 * rien — c'est pourquoi la seule garde nécessaire est qu'on ne touche que ses
 * propres messages.
 */
create or replace function public.message_was_sent(
  which uuid,
  why text default null
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  update public.contact_messages m
  set sent_at = case when why is null then now() else null end,
      failure = why
  where m.id = which and m.user_id = auth.uid();
end;
$$;

revoke all on function public.message_was_sent(uuid, text) from public, anon;
grant execute on function public.message_was_sent(uuid, text) to authenticated, service_role;;
