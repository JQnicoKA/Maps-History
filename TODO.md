# Ce qui reste

État au 4 octobre 2026. Chaque ligne a été vérifiée contre le code ou contre la
base avant d'être écrite ici — la version précédente de ce fichier datait d'un
audit de septembre dont sept points sur dix étaient déjà réglés, ce qui est pire
qu'un fichier absent.

---

## Avant la première soumission

**La protection contre les mots de passe fuités est désactivée.** Supabase →
Authentication → Password. Un interrupteur, et c'est le seul avertissement de
sécurité qui reste au tableau de bord.

**`contact@historynote.fr` ne reçoit rien.** L'adresse est citée quatre fois
dans les pages en ligne et dans le message qui suit un signalement. Une
redirection depuis l'onglet E-mails d'OVH suffit.

**Pas de `buildNumber` ni de `versionCode`.** `version: 1.0.0` seule ne permet
pas de soumettre deux fois.

**Deux comptes de test traînent** — `30532a91` et `6eebeffc`, créés le
30 septembre, sans aucun contenu. À supprimer avant l'ouverture.

---

## Dette connue, non bloquante

**Rien hors-ligne, aucune reprise.** Une coupure réseau pendant un
enregistrement perd la saisie. Le cache de tuiles couvre la carte
(`TILE_CACHE_BYTES`), pas les écritures.

**Textes en dur, aucune internationalisation.** Tout est en français dans le
code. Ce n'est un problème que le jour où l'app sort de France.

**Tailles de police fixes.** L'app ignore Dynamic Type, ce qui est un vrai
sujet pour une application qu'on lit.

**Le rechargement après une copie est large.** `refresh()` relit les quatre
collections alors qu'une copie d'événement n'en touche que deux. Examiné le
4 octobre et **délibérément laissé** : une à trois requêtes économisées, une
fois par copie, pendant que le lecteur regarde déjà un indicateur. La
machinerie coûterait plus que le gain.

**`tree_members.note` est branchée mais jamais affichée.** Recopiée par
`copy_tree`, lue par l'application, portée par le type — et aucun écran ne la
montre. Soit on en fait quelque chose, soit on la retire comme `mark` l'a été.

---

## Les tuiles auto-hébergées

Chantier à part, en pause. Deux documents le portent :

- `docs/construire-les-tuiles.md` — la construction sur serveur loué et la
  publication sur R2, éprouvée jusqu'à la Suisse.
- `docs/brancher-les-tuiles.md` — le branchement côté application.

Le code est **déjà en place** : `EXPO_PUBLIC_TILES_URL` vide fait lire
MapTiler, renseignée fait lire notre archive. Il ne manque que l'archive.

**Le déclencheur, décidé d'avance** : 300 000 requêtes MapTiler par mois, ou la
première ligne de dépassement sur une facture.

---

## Ce qui a été réglé, pour ne pas le réexaminer

Septembre–octobre 2026, vérifié :

| | |
|---|---|
| nom de classeur unique par compte | `folders_owner_name_key` sur `(user_id, lower(name))` |
| stockage cloisonné par compte | les policies vérifient `(storage.foldername(name))[1] = auth.uid()` |
| photos effacées avec leur événement | et désormais **seulement si personne d'autre ne les référence** — voir `erasable_by_me` et `forget()` |
| mot de passe oublié, changement, suppression de compte | faits |
| error boundary | `src/components/ErrorBoundary.tsx` |
| images redimensionnées avant l'envoi | `src/features/events/shrink.ts` |
| index chronologique par compte | `events_owner_chronology_idx` |
| table `territories` (OHM) de 76 Mo | supprimée — la base est passée de 130 à 55 Mo |
| tests versionnés | 12 fichiers, 139 tests |
| rapports de crash | Sentry, `src/lib/monitoring.ts` |
| `eas.json`, CI | présents |
| conditions d'utilisation et confidentialité | en ligne, à jour du 1<sup>er</sup> octobre |
| clé MapTiler restreinte | par User-Agent — voir la note de mémoire |
| copie atomique des contributions | Edge Function `copy`, plus le filet `mend` |
| colonne morte `tree_members.mark` | retirée |
| icône adaptative Android | dérivée de l'icône réelle, le gabarit Expo est parti |
