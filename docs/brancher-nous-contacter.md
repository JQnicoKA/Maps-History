# Brancher « Nous contacter »

Tout est écrit et déployé. Il manque **une clé et une adresse**, que moi je ne
peux pas poser : les écritures de secrets sont refusées par les permissions de
l'assistant, et c'est mieux ainsi — une clé d'API n'a pas à passer par une
conversation.

En attendant, la fonctionnalité **marche déjà à moitié** : un message envoyé
depuis l'application est enregistré dans `contact_messages`, avec
`failure = 'RESEND_API_KEY ou CONTACT_TO absent'`. Rien n'est perdu ; rien ne
part.

## 1. La clé Resend

1. <https://resend.com> → **API Keys** → *Create API Key*.
2. Droit **Sending access** seulement : cette clé n'a besoin que d'envoyer.
3. Copiez-la — Resend ne la remontre jamais.

## 2. Les deux secrets

Dans le tableau de bord — **la CLI Supabase n'est pas installée sur ce poste et
le projet n'y est pas lié**, donc c'est la route à prendre :

<https://supabase.com/dashboard/project/tjncxgllacvugsjinirf/settings/functions>

| Nom | Valeur |
|---|---|
| `RESEND_API_KEY` | la clé créée à l'étape 1 |
| `CONTACT_TO` | `chillbug.sas@gmail.com` |

La fonction les lit au prochain appel : **aucun redéploiement n'est
nécessaire.**

> **Jamais dans `.env`.** Expo inline tout ce qui porte `EXPO_PUBLIC_` dans le
> bundle, et même sans ce préfixe un `.env` n'atteint pas les Edge Functions :
> elles tournent chez Supabase, pas sur le téléphone. Une clé d'envoi de
> courriel posée côté client serait lisible par quiconque déballe
> l'application, et servirait à expédier du courrier en votre nom.

Si vous installez la CLI un jour (`brew install supabase/tap/supabase`), la
même chose se fait sans que la clé paraisse à l'écran ni dans l'historique :

```sh
read -rs -p "Clé Resend : " RESEND && echo
supabase secrets set RESEND_API_KEY="$RESEND" --project-ref tjncxgllacvugsjinirf
unset RESEND
```

## 3. L'expéditeur

`CONTACT_FROM` est **facultatif** : à défaut, la fonction expédie depuis
`HistoryNote <contact@historynote.fr>`, l'adresse que l'application publie
déjà. Ne le posez que pour expédier depuis une autre adresse.

Le domaine du `from` doit être vérifié chez Resend — Resend → **Domains**, puis
les enregistrements SPF/DKIM chez le registraire. `historynote.fr` l'est.

> **Le repli fut `onboarding@resend.dev`, et c'était un piège coûteux.** Ce
> domaine d'essai n'exige aucune vérification, d'où son attrait ; mais il
> n'autorise l'envoi qu'à l'adresse du titulaire du compte Resend, et refuse
> tout le reste par un 403 dont le texte dit « please verify a domain ». On
> croit donc qu'il manque une vérification alors qu'il manque un expéditeur :
> **un domaine vérifié ne sert à rien si le `from` ne l'emploie pas.** Un
> défaut qui dégrade en silence est pire qu'un défaut qui manque.

## 4. Vérifier

Écrivez-vous un message depuis l'application, puis :

```sql
select created_at, email, left(body, 60) as debut, sent_at, failure
from public.contact_messages
order by created_at desc
limit 5;
```

- `sent_at` rempli → le courriel est parti.
- `failure` rempli → il ne l'est pas, et la colonne dit pourquoi.

Les journaux de la fonction : **Edge Functions → contact → Logs**.

## Ce qui a été bâti

| Pièce | Où |
|---|---|
| La table | `contact_messages` — RLS active, **aucune policy** |
| Les deux portes SQL | `write_to_us(body)`, `message_was_sent(which, why)` |
| La fonction de bord | `supabase/functions/contact/index.ts` |
| L'appel côté client | `src/screens/Account/writeToUs.ts` |
| L'onglet | `src/screens/Account/AccountScreen.tsx`, face `"contact"` |

### Trois décisions à connaître

**Le dépôt précède l'expédition.** La ligne est écrite, puis le courriel part,
puis le résultat est noté. Dans l'autre ordre, une clé révoquée ferait
disparaître le message sans que personne sache qu'il a existé.

**Aucun privilège élevé.** La fonction agit avec le jeton de son appelant et ne
peut faire que ce que les deux portes autorisent — comme `copy`, et pour la
même raison écrite dans son en-tête : *« le modèle de sécurité de ce projet est
fait de portes étroites vérifiées par Postgres, pas de clés qui ouvrent
tout. »* `service_role` n'apparaît nulle part.

**Ce que Postgres garde pour lui**, parce que le client pourrait mentir :
l'adresse de réponse, lue dans `auth.users` et jamais fournie par l'appelant ;
la cadence, cinq messages par heure ; la longueur, de 10 à 4 000 caractères.
L'écran répète ces deux dernières bornes pour ne pas laisser presser un bouton
qui se ferait refuser — si les deux divergent un jour, c'est l'écran qui a tort.

## Défaire

```sql
drop function if exists public.write_to_us(text);
drop function if exists public.message_was_sent(uuid, text);
drop table if exists public.contact_messages;
```

Puis supprimer la fonction de bord `contact`, les trois secrets, et retirer du
code : `src/screens/Account/writeToUs.ts`, la face `"contact"` et sa rangée
dans `AccountScreen.tsx`.
