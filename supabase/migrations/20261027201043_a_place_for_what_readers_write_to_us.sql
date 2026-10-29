-- Ce qu'un lecteur nous écrit depuis sa page de compte.
--
-- **Gardé ici avant d'être expédié**, et c'est l'essentiel de cette table : un
-- courriel qui échoue est un message perdu, et perdu sans qu'on sache qu'il a
-- existé. La ligne est écrite d'abord, l'envoi vient ensuite, et `sent_at` dit
-- lequel des deux a eu lieu. Une clé d'API absente ou révoquée ne coûte alors
-- que le courriel, jamais le message.
--
-- Elle sert aussi à limiter la cadence : sans elle, le bouton « Envoyer » est
-- un canon à courrier.
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  /**
   * L'adresse au moment de l'écriture, recopiée.
   *
   * Et non lue dans `auth.users` à la lecture : c'est l'adresse à laquelle
   * répondre, elle doit survivre à un changement d'adresse et même à la
   * suppression du compte — sauf que la cascade emporte la ligne, ce qui est
   * le bon arbitrage : quelqu'un qui efface son compte n'a pas demandé qu'on
   * garde ses messages.
   */
  email text not null,
  body text not null,
  created_at timestamptz not null default now(),
  /** Quand le courriel est parti. Null tant qu'il n'est pas parti. */
  sent_at timestamptz,
  /** Pourquoi il n'est pas parti, s'il n'est pas parti. */
  failure text,
  constraint contact_messages_body_said check (
    length(btrim(body)) between 10 and 4000
  )
);

create index contact_messages_by_author
  on public.contact_messages (user_id, created_at desc);

/**
 * Verrouillée, et **sans une seule policy**.
 *
 * Ce n'est pas un oubli. Aucun client ne doit toucher cette table, ni pour
 * écrire ni pour lire : la fonction de bord `contact` est la seule porte, et
 * elle y entre par la clé `service_role`, que RLS ne regarde pas.
 *
 * Écrire depuis le client aurait laissé poster une ligne sans que le courriel
 * suive, et lire depuis le client aurait rendu les messages des autres
 * atteignables à la première policy mal écrite. Il n'y a rien à mal écrire.
 */
alter table public.contact_messages enable row level security;

revoke all on table public.contact_messages from anon, authenticated;

comment on table public.contact_messages is
  'Les messages écrits depuis « Nous contacter », gardés avant expédition. Seule la fonction de bord `contact` y touche.';;
