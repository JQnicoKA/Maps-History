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

**Les photographies d'événements n'ont pas de couleur dominante.** La colonne
`tint` n'existe que sur `character_photos`, parce que la carte d'un arbre est
la seule chose qui en demandait une. L'étendre, le jour où un classeur ou un
marqueur voudrait la sienne, c'est une colonne, une ligne dans `PHOTOS` côté
Edge Function et une ligne dans `storedPhotos` — `StoredPhoto.tint` est déjà
là et vaut `null` pour elles.

**`tree_members.note` est branchée mais jamais affichée.** Recopiée par
`copy_tree`, lue par l'application, portée par le type — et aucun écran ne la
montre. Soit on en fait quelque chose, soit on la retire comme `mark` l'a été.

---

## Un avertissement de sécurité qui restera, et c'est normal

Trois, examinés le 7 octobre 2026 et **délibérément laissés** — les réexaminer
coûterait le même temps pour la même conclusion :

**`st_estimatedextent` appelable par `anon`.** Fonction PostGIS en `security
definer`, et l'ACL accorde bien `EXECUTE` à `anon`. Mais ses trois surcharges
sont déclarées **sans nom d'argument**, et PostgREST apparie les paramètres par
leur nom : la fonction n'a donc aucune route par l'API — vérifié, `PGRST202` sur
les quatre formes essayées. Et on ne peut pas retirer le droit : elle appartient
à `supabase_admin`, le projet tourne en `postgres`, et un `revoke` par un autre
rôle échoue en silence. Le linter lit l'ACL, pas l'accessibilité.

**`spatial_ref_sys` sans RLS.** Table PostGIS des systèmes de coordonnées,
propriété de l'extension : la RLS n'y est pas activable sans en être
propriétaire, et elle ne contient aucune donnée de lecteur.

**`postgis` installé dans `public`.** La déplacer casserait tout ce qui en
dépend pour un gain de pure forme.

---

## Les tuiles auto-hébergées

**L'archive existe depuis le 10 octobre 2026.** Construite sur une CCX63 à
Helsinki en 13 min 34 s, publiée sur R2 (bucket `history-note-map`, juridiction
européenne), serveur détruit le jour même. Coût total : ~1,40 €.

| | |
|---|---|
| fichier | `planet-z10-2026-10.pmtiles` |
| poids | 2,1 Go — **sous le seuil gratuit de 10 Go chez R2** |
| couverture | le monde, zooms 0 à 10, les cinq calques |
| `206 Partial Content` | vérifié, c'était la seule inconnue technique |

Les deux documents sont à jour de ce parcours :
`docs/construire-les-tuiles.md` (toutes ses mesures sont désormais réelles) et
`docs/brancher-les-tuiles.md` (le branchement côté application).

**Ce qu'il reste à faire, et rien ne presse :**

1. **Une adresse définitive.** L'archive n'est joignable que par son adresse
   `pub-….r2.dev`, que Cloudflare bride et réserve au développement. Il faut
   rattacher un domaine, ce qui suppose la zone DNS chez Cloudflare — or
   `historynote.fr` est chez OVH **avec les MX du courriel**. Trois sorties au
   § 9 du runbook : déplacer la zone, déléguer `tiles.historynote.fr` seul, ou
   prendre un autre domaine.
2. **Renseigner `EXPO_PUBLIC_TILES_URL`** et republier. Le code est déjà en
   place : vide il lit MapTiler, renseignée il lit notre archive.
3. **Mettre à jour la page de confidentialité le même jour.** Elle nomme
   MapTiler (Suisse) comme sous-traitant et promet qu'il n'y a aucun transfert
   hors EEE ; Cloudflare la remplace. La juridiction européenne du bucket est
   ce qui permet de garder la promesse telle quelle.

**Et le crédit obligatoire** : les tuiles sont sous CC-BY d'OpenMapTiles, la
mention « © OpenMapTiles © OpenStreetMap contributors » devra être visible
dans l'app. Elle est déjà inscrite dans les métadonnées de l'archive.

**Le déclencheur du basculement, décidé d'avance** : 300 000 requêtes MapTiler
par mois, ou la première ligne de dépassement sur une facture. Rien n'oblige à
basculer avant.

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
| couleur dominante des portraits | Edge Function `tint`, colonnes `character_photos.tint` / `tinted_at`, domestication par `inWax` |
| seau de photos restreint | `image/{jpeg,png,webp,heic,heif}` et 10 Mo — éprouvé : HTML et SVG refusés en 415, 12 Mo en 413 |
| un profil ne se lit que par son titulaire | la policy était `USING (true)` sur toute la ligne ; les pseudonymes des autres passent par les portes `security definer` |
