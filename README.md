# Maps History

Prototype React Native : une carte du monde plein écran, géographiquement
exacte (données OpenStreetMap via MapTiler), rendue comme une planche d'atlas
ancien gravée sur parchemin.

Deux couches : une carte du monde manipulable au doigt, et des **événements
historiques** posés dessus — géographiquement, chronologiquement, classés par
sujet et par importance. Backend Supabase, sans comptes utilisateurs pour
l'instant.

---

## 1. Choix techniques

### Expo (dev build) plutôt que React Native CLI

`@maplibre/maplibre-react-native` publie un **config plugin Expo officiel**
(`app.plugin.js` dans le paquet) : c'est lui qui injecte
`$MLRN.post_install(installer)` dans le `Podfile` iOS et qui configure Gradle
côté Android. Avec le CLI nu, ces deux étapes sont manuelles et se re-cassent à
chaque upgrade.

On garde donc Expo, mais **pas Expo Go** : MapLibre est du code natif, il faut
une *development build* (`npx expo run:ios` / `run:android`). Les dossiers
`ios/` et `android/` sont générés à la demande (Continuous Native Generation) et
volontairement git-ignorés — la configuration native vit dans `app.json`.

### Versions vérifiées ensemble

| Paquet | Version | Note |
| --- | --- | --- |
| `expo` | `~56.0.21` | SDK 56 — **pas** le 57, voir ci-dessous |
| `react-native` | `0.85.3` | version épinglée par le SDK 56 |
| `react` | `19.2.3` | |
| `@maplibre/maplibre-react-native` | `^11.3.9` | peer deps : `expo >=54`, `react-native >=0.80`, `react >=19.1` |
| `expo-system-ui` | `~56.0.5` | fond parchemin au lancement (évite le flash blanc) |
| `@supabase/supabase-js` | `^2.109.0` | base de données + stockage des photos |
| `expo-image-picker` | `~56.0.25` | photos des événements |
| `react-native-safe-area-context` | `~5.7.0` | encoches et barre d'accueil |
| `typescript` | `~6.0.3` | mode `strict` + options additionnelles |

`@maplibre/maplibre-react-native` v11 supporte la New Architecture (Fabric /
TurboModules, `codegenConfig` présent) et ses peer deps demandent `expo >= 54`,
`react-native >= 0.80`, `react >= 19.1` — le SDK 56 les satisfait toutes.

### Pourquoi le SDK 56 et pas le 57

Le SDK 57 ne compile pas sous Xcode 26.2 / Swift 6.2.3. Son `expo-modules-jsi`
cumule deux régressions absentes du SDK 56 :

1. Les deux constructeurs de `RuntimeScheduler` sont annotés
   `SWIFT_RETURNS_RETAINED` — ajouté par Expo pour satisfaire Xcode 27
   ([PR #49120](https://github.com/expo/expo/pull/49120)), ce qui casse
   Xcode 26.2 : l'attribut `SWIFT_SHARED_REFERENCE` de la classe n'apparaît
   qu'à l'accolade fermante.
2. `JavaScriptRuntime.swift` fait traverser des pointeurs bruts dans des
   closures `JavaScriptActor`, que Swift 6.2.3 rejette (`sending … risks
   causing data races`). Le `nonisolated(unsafe)` qu'Expo applique déjà ne
   suffit plus. Le SDK 56 construit le buffer **avant** la closure, donc aucun
   pointeur ne franchit l'isolation.

Voir [expo/expo#49667](https://github.com/expo/expo/issues/49667) ; la PR qui
corrigeait le point 1 a été fermée sans merge, et aucun correctif n'est publié
pour la branche 57.

Redescendre de Xcode n'est pas une option : l'iPhone cible tourne sous iOS 26,
que seul Xcode 26.x sait déployer.

Contrepartie assumée : `expo-doctor` signale que le SDK 56 embarque un Hermes V1
touché par une régression **mémoire**, corrigée en React Native 0.86.2. Ce n'est
pas un défaut de correction, et la remontée en SDK 57 se fera dès qu'Expo aura
réparé son build sous Xcode 26.2.

`@maplibre/maplibre-gl-style-spec` est en `devDependencies` uniquement : on ne
s'en sert que pour typer les expressions du style (aucun impact sur le bundle).

### Fournisseur de tuiles : MapTiler

Vector tiles **MapTiler Cloud**, schéma OpenMapTiles (`tiles/v3`) :
frontières, côtes, lacs, rivières, landcover, toponymes actuels. Plus les
tuiles d'élévation `terrain-rgb-v2` pour l'ombrage du relief.

Le style est **100 % maison** (`src/map/style/`) : géographie moderne, rendu
ancien. Aucun style MapTiler prêt à l'emploi n'est chargé.

### Backend : Supabase

Quatre tables, un bucket. Le point de conception qui structure tout le reste :
**l'importance n'appartient pas à l'événement mais au couple événement/classeur**.

```
folders         id, name
events          id, title, description, dates…, longitude, latitude
event_folders   (event_id, folder_id) → importance    ← clé primaire composite
event_photos    id, event_id, storage_path, position
bucket          event-photos (public)
```

La prise de Constantinople est ainsi « élevée » dans *Empire ottoman* et
« moyenne » dans *Renaissance*, sans dupliquer l'événement.

**Les dates ne sont pas des `date` SQL.** L'histoire a besoin d'années avant
J.-C. et de dates imprécises — « 1299 », « mars 1453 » — qu'une colonne `date`
ne sait pas exprimer. On stocke donc une année signée (négative = av. J.-C.)
plus un mois et un jour facultatifs, avec les contraintes qui vont avec : un
jour sans son mois est refusé, une fin antérieure au début aussi. `end_*` est
renseigné pour les événements qui durent (une guerre, un règne).

RLS est **activé** sur les quatre tables, avec une policy permissive pour `anon`
explicitement marquée comme temporaire. Le jour où les comptes arrivent, ce sont
ces quatre policies qui changent — pas le schéma.

---

## 2. Installation

```bash
cd Maps-History
npm install
cp .env.example .env      # puis coller votre clé MapTiler dedans
```

Créer une clé sur <https://cloud.maptiler.com/account/keys/> (offre gratuite :
100 000 requêtes de tuiles/mois), puis dans `.env` :

```
EXPO_PUBLIC_MAPTILER_API_KEY=votre_cle_ici
```

> Le préfixe `EXPO_PUBLIC_` est ce qui déclenche l'injection de la variable dans
> le bundle par Expo CLI. La clé est donc **lisible dans l'app compilée** — c'est
> inévitable pour une carte côté client. Restreignez-la par bundle identifier /
> origines autorisées dans le tableau de bord MapTiler plutôt que d'essayer de
> la cacher. `.env` est git-ignoré.
>
> En code, il faut toujours écrire `process.env.EXPO_PUBLIC_MAPTILER_API_KEY`
> en notation pointée : `process.env[nom]` n'est pas remplacé par le bundler.

Puis les identifiants Supabase (tableau de bord > Project Settings > API) :

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_xxxxxxxx
```

La clé *publishable* est faite pour vivre dans un client : l'accès réel est
gouverné par les policies RLS, pas par le secret de la clé. La clé
`service_role`, elle, contourne RLS — elle ne doit jamais entrer dans ce fichier.

Sans ces variables, l'app affiche un écran listant ce qui manque au lieu d'une
carte vide.

---

## 3. Lancer l'application

### iOS (macOS + Xcode requis)

```bash
npm run ios
```

Premier lancement : Expo génère `ios/`, installe les pods et récupère MapLibre
Native via Swift Package Manager, puis compile. Comptez 10–20 min. Les fois
suivantes, `npm start` suffit (la dev build est déjà installée).

### Android (Android Studio + JDK 17 requis)

```bash
npm run android
```

Sur cette machine, ni le SDK Android ni un JDK ne sont installés — il faut
d'abord Android Studio (SDK Platform 35 + un AVD) et un JDK 17, avec
`ANDROID_HOME` et `JAVA_HOME` exportés.

### Autres commandes

```bash
npm start            # serveur Metro (dev build déjà installée)
npm run typecheck    # tsc --noEmit
npm run prebuild     # régénère ios/ et android/ de zéro
npm run textures     # régénère les textures parchemin
```

---

## 4. Structure

```
index.ts                          point d'entrée Expo
app.json                          config Expo + config plugin MapLibre
.env.example                      modèle de configuration
scripts/generate-textures.mjs     génère les PNG de parchemin (sans dépendance)
assets/textures/                  paper-grain.png, vignette.png

src/
  App.tsx
  config/
    env.ts                        lecture/validation des variables d'env
    map.ts                        zooms, vue initiale, flags, attribution
  theme/
    palette.ts                    palette parchemin (carte + UI)
  map/
    style/
      createOldAtlasStyle.ts      assemble la StyleSpecification
      sources.ts                  sources MapTiler + graticule
      graticule.ts                grille lat/lon en GeoJSON
      typography.ts               piles de polices
      layers/
        land.ts                   parchemin + lavis de landcover
        relief.ts                 ombrage sépia (hillshade)
        water.ts                  mers, lacs, rivières, ombre côtière
        graticule.ts              rendu de la grille
        boundaries.ts             frontières actuelles
        labels.ts                 toponymie
  lib/
    supabase.ts                   client (construit paresseusement)
    base64.ts                     décodeur pour l'upload des photos
  features/
    events/
      types.ts                    modèle de domaine
      api.ts                      requêtes Supabase
      historicalDate.ts           années signées, dates imprécises, formatage
      filtering.ts                importance effective + filtres
      EventsProvider.tsx          état partagé (Context + hooks)
      components/
        EventMarkers.tsx          source GeoJSON + couches MapLibre
        EventFormModal.tsx        formulaire de création
        EventDetailModal.tsx      fiche complète
        EventSummaryCard.tsx      tuile de résumé
        FolderSelector.tsx        classeurs (liste déroulante) + importance
        ImportanceRow.tsx         élevée / moyenne / faible pour un classeur
        PhotoPicker.tsx           sélection des photos
        LocationReticle.tsx       placement du lieu au réticule
        AddEventButton.tsx        le bouton +
    filters/
      FilterButton.tsx            le mot « Tous » en haut de l'écran
      FilterModal.tsx             classeurs + importance de chacun
    timeline/
      Timeline.tsx                frise en barre d'échelle graduée
      TimelineArrow.tsx           flèches, de part et d'autre de la frise
  components/
    ui/                           primitives parchemin (Paper, InkButton,
                                  SelectField : liste déroulante…)
    WorldMap/
      WorldMap.tsx                le composant carte, isolé
      ParchmentOverlay.tsx        grain de papier + vignettage
      MapAttribution.tsx          crédit MapTiler/OSM (obligatoire)
  screens/
    MapScreen/
      MapScreen.tsx               compose carte, filtres, frise, modales
      MissingConfigNotice.tsx
```

### Décisions d'implémentation

- **Les événements sont une source GeoJSON, pas N marqueurs React.** Une seule
  source, quatre couches MapLibre, l'importance devient une expression de style.
  Le rendu reste fluide quel que soit le nombre d'événements, et le clic passe
  par `queryRenderedFeatures` sur une couche de touche invisible de 18 pt —
  une pastille de 6 pt n'est pas une cible tactile.
- **Le lieu se place au réticule, pas au tap.** Viser du doigt une carte qu'on
  est en train de déplacer est un combat ; on amène le lieu sous une croix fixe
  puis on confirme.
- **Pas de bibliothèque d'état.** Un Context et des `useMemo` suffisent :
  filtres, sélection et liste dérivée tiennent dans un seul fournisseur.
- **L'upload passe par base64.** React Native n'a ni `atob` ni `Buffer`, et
  `fetch('file://')` est peu fiable ; le décodeur maison de `lib/base64.ts`
  évite une dépendance pour quinze lignes.

### Où brancher la suite

- **Comptes utilisateurs** : les quatre policies RLS `prototype open access` et
  les trois policies du bucket sont les seuls endroits à changer. Le schéma
  gagne une colonne `owner_id` et les policies la comparent à `auth.uid()`.
- **Nouvelles couches de style** : un fichier dans `src/map/style/layers/`,
  branché dans `createOldAtlasStyle` — l'ordre du tableau `layers` est l'ordre
  d'impression (papier → lavis → relief → eau → grille → frontières → texte).
- **Régions interactives, overlays** : `<WorldMap>` accepte des `children`
  MapLibre, comme `<EventMarkers>`. Rien à toucher dans `WorldMap.tsx`.
- **Édition d'un événement** : `api.ts` a déjà `createEvent` et `deleteEvent` ;
  un `updateEvent` suit le même moule, et `EventFormModal` accepte un état
  initial.

---

## 5. Les événements historiques

**Ajouter.** Le bouton `+` en haut à droite ouvre le formulaire : titre,
description, date, photos, classeurs et lieu. « Placer sur la carte » masque le
formulaire, affiche un réticule fixe au centre — on déplace la carte pour
amener le lieu dessous — puis « Confirmer » revient au formulaire avec les
coordonnées, la saisie intacte.

**Dates.** Trois champs : jour, mois, année. Seule l'année est obligatoire ;
« 1453 » seul est une date valide. Une année négative (`-330`) ou suffixée
(`330 av`) signifie avant J.-C. L'interrupteur *Période* ajoute une date de fin
pour ce qui dure.

**Classeurs et importance.** Le champ *Classeurs* ouvre une liste déroulante —
elle reste lisible quel que soit le nombre de sujets — et on y crée un classeur
à la volée. Chaque classeur coché reçoit ensuite sa propre importance. C'est là
que se matérialise le modèle : un événement majeur pour un sujet et secondaire
pour un autre.

**Filtrer.** Un seul mot en haut de l'écran, « Tous » par défaut, qui prend le
nom du classeur choisi ou compte ceux qui le sont. Il ouvre une popup : la même
liste déroulante de classeurs, puis pour chaque classeur coché son importance,
« Toutes » par défaut. Plusieurs classeurs se cumulent en union — leurs
événements s'additionnent. Le filtre pilote la carte *et* la frise.

**Parcourir.** La frise du bas est la barre d'échelle graduée d'une carte
ancienne : elle couvre l'intervalle des événements sélectionnés, chacun posé
dessus en losange, celui qu'on regarde encré à la cire et surmonté de son année.
Les flèches l'encadrent, à gauche et à droite de l'écran. Cliquer un événement —
sur la carte, sur la frise ou via les flèches — recentre la planche **sans
changer le zoom** et fait apparaître une tuile de résumé ; la tuile ouvre la
fiche complète.

---

## 6. Le style « atlas ancien »

Tout est dans `src/map/style/`. Les partis pris :

- **Papier** : la couche `background` est la terre (`#E7D8B8`) ; l'eau est
  peinte par-dessus, comme dans le schéma OpenMapTiles.
- **Lavis** : forêts, prairies, sable, marais en fills translucides (opacité
  0,3 → 0,5) pour que le ton du papier transparaisse. Les calottes glaciaires
  sont plus opaques.
- **Relief** : `hillshade` sur les tuiles `terrain-rgb-v2`, avec ombres brunes
  et hautes lumières crème — l'équivalent moderne des hachures gravées.
  L'exagération décroît avec le zoom.
- **Côtes** : un trait large et flouté (`line-blur`) à l'intérieur du littoral
  reproduit l'ombrage concentrique des gravures, plus un trait d'encre fin.
- **Frontières** : un lavis coloré large et flou sous une fine ligne d'encre —
  la frontière « coloriée » des atlas. Les frontières contestées sont en
  pointillés, les frontières maritimes ne sont pas dessinées.
- **Graticule** : grille de 15°, générée en GeoJSON (OpenMapTiles n'en fournit
  pas), estompée au-delà du zoom 5.
- **Typographie** : MapTiler Cloud ne sert **pas** de polices à empattements
  (Noto Sans, Metropolis, Open Sans, PT Sans, Roboto uniquement). Le caractère
  ancien vient donc de la *composition* : capitales très espacées pour les
  terres, italiques pour l'hydrographie — exactement la convention des planches
  gravées. Pour un vrai serif, pointez `glyphs` dans `createOldAtlasStyle` vers
  un serveur de glyphes auto-hébergé (voir `openmaptiles/fonts`).
- **Texture** : grain de papier tuilé + vignettage, dessinés *au-dessus* de la
  carte (`ParchmentOverlay`) et non cuits dans les tuiles, pour que la
  géographie reste nette à tous les zooms. Les PNG sont générés par
  `scripts/generate-textures.mjs` (zéro dépendance).

Les couleurs sont centralisées dans `src/theme/palette.ts` — c'est le fichier à
ouvrir pour ajuster le rendu.

### Zoom

`src/config/map.ts` :

| | zoom |
| --- | --- |
| minimum | 0 |
| monde | ~1 |
| continent | ~3 |
| pays | ~5 |
| région | ~8 |
| maximum | 11 |

La source vectorielle est plafonnée à **z10** (`TILE_MAX_ZOOM`) : au-delà,
MapLibre sur-zoome les tuiles z10 au lieu de télécharger les z11–z14, qui ne
contiennent que du bâti et de la voirie que ce style ne dessine jamais. Moins de
requêtes, moins de mémoire, pan/zoom plus fluide.

Aucune couche `transportation`, `building` ou `poi` n'est chargée.

---

## 7. Pièges iOS / Android

**Expo Go affiche une erreur de module natif.**
Attendu : MapLibre ne fait pas partie du SDK Expo. Il faut une dev build
(`npm run ios` / `npm run android`), pas Expo Go.

**iOS : `pod install` échoue ou MapLibre est introuvable.**
Le config plugin doit être dans `app.json` (`"plugins": ["@maplibre/maplibre-react-native"]`)
et le natif régénéré : `npm run prebuild && npm run ios`. MapLibre Native est
récupéré via Swift Package Manager, la première résolution peut être longue.

**iOS : `xcodebuild` exited with error code 65 dans `expo-modules-jsi`.**
Symptôme d'un passage en SDK 57 : ce paquet ne compile pas sous Xcode 26.2.
Rester en SDK 56 (voir « Pourquoi le SDK 56 et pas le 57 »). Le projet ne porte
aucun patch local d'Expo — si vous en ajoutez un, il sera à retirer dès qu'Expo
publiera le correctif.

**iOS : la build reste bloquée sur `Connecting to: <votre iPhone>`.**
La compilation est terminée à ce stade ; c'est l'installation sur l'appareil qui
attend. iPhone déverrouillé, Mode développeur activé (Réglages → Confidentialité
et sécurité), et lancer la commande sans `--no-bundler` pour que Metro tourne.

**Android : `SDK location not found` / `Unable to locate a Java Runtime`.**
Installer Android Studio et un JDK 17, puis exporter `ANDROID_HOME` et
`JAVA_HOME`.

**Android : carte noire ou artefacts sur émulateur.**
Le backend par défaut est OpenGL. Si l'émulateur pose problème, passer le
plugin en Vulkan dans `app.json` :

```json
["@maplibre/maplibre-react-native", { "android": { "nativeVariant": "vulkan" } }]
```

Puis `npm run prebuild && npm run android`.

**Android : la carte clignote quand on superpose des vues.**
Passer `androidView="texture"` sur `<Map>` (rendu un peu plus coûteux, mais
compose correctement avec les vues RN au-dessus).

**Modifier `.env` ne change rien.**
Les variables sont injectées au bundling : recharger complètement l'app
(`r` dans Metro ne suffit pas toujours, redémarrer `npm start`).

**Tuiles vides / erreurs 403.**
Clé absente, invalide, quota MapTiler dépassé, ou clé restreinte à un bundle
identifier différent de `com.mapshistory.app` (voir `app.json`).

**Le crédit MapTiler/OpenStreetMap.**
L'ornement natif d'attribution est désactivé (`attribution={false}`) et remplacé
par `MapAttribution`, stylé pour la carte. Les CGU MapTiler et la licence ODbL
imposent ce crédit visible : ne pas le supprimer.

---

## 8. État

- Build iOS device : **réussie** avant l'ajout des événements ; deux modules
  natifs ont été ajoutés depuis (`expo-image-picker`,
  `react-native-safe-area-context`), donc **une reconstruction est nécessaire**.
- `npm run typecheck` : OK.
- Bundle Metro : OK (750 modules).
- Schéma Supabase appliqué, `get_advisors` (sécurité) : aucune alerte.
- Chaîne complète vérifiée à travers RLS avec la clé publishable : lecture avec
  les jointures imbriquées, écriture, et rejet des dates incohérentes.
- Quatre événements de démonstration sont en base (987, 1214, 1453, 1520–1566)
  pour que la carte et la frise aient de quoi s'afficher au premier lancement.
  Ils se suppriment depuis la fiche de chaque événement.
- Le rendu des événements n'a pas encore été vu à l'écran.
- Le remaniement visuel (frise, filtres, listes déroulantes) est purement
  JS/TS : un rechargement Metro suffit, pas de reconstruction native.
