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
| `@resvg/resvg-js` | `2.6.2` | **devDependency** : rasterise les icônes hors-ligne |

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
folders         id, name, user_id
events          id, title, type, description, dates…, longitude, latitude, user_id
event_folders   (event_id, folder_id) → importance    ← clé primaire composite
event_photos    id, event_id, storage_path, position, source
bucket          event-photos (public en lecture, écriture réservée aux connectés)
```

La prise de Constantinople est ainsi « élevée » dans *Empire ottoman* et
« moyenne » dans *Renaissance*, sans dupliquer l'événement.

**Les dates ne sont pas des `date` SQL.** L'histoire a besoin d'années avant
J.-C. et de dates imprécises — « 1299 », « mars 1453 » — qu'une colonne `date`
ne sait pas exprimer. On stocke donc une année signée (négative = av. J.-C.)
plus un mois et un jour facultatifs, avec les contraintes qui vont avec : un
jour sans son mois est refusé, une fin antérieure au début aussi. `end_*` est
renseigné pour les événements qui durent (une guerre, un règne).

### Comptes et cloisonnement

Depuis l'arrivée des comptes, **tout ce qu'un lecteur crée appartient à son
compte** : `events`, `folders`, `characters` et `trees` portent un `user_id`
(`references auth.users on delete cascade`), et les tables filles — photos,
liaisons, membres et liens d'arbre — héritent de ce propriétaire à travers leur
parent. Il n'y a donc qu'un seul endroit où la propriété est définie.

Deux choses portent ce cloisonnement sans une ligne de code applicatif :

- `user_id` a pour défaut `auth.uid()`. Le client n'envoie jamais de
  propriétaire ; c'est la base qui l'estampille.
- les policies RLS valent `using (user_id = auth.uid())` **et**
  `with check (...)`. Le `with check` est celui qui compte : sans lui, on peut
  écrire une ligne au nom de quelqu'un d'autre. Pour `event_folders`,
  `event_characters` et `tree_members`, les deux extrémités sont vérifiées — on
  ne range pas son événement dans le classeur d'autrui.

### Deux lectures d'un événement

La carte, la frise et la liste tiennent **tous** les événements en mémoire : la
frise en marque chacun sur cinq millénaires, les deux flèches parcourent la
liste ordonnée entière, les marqueurs en sont tirés. Ce qui peut manquer, en
revanche, c'est ce que seul un événement ouvert montre.

D'où deux types, et l'un **étend** l'autre :

- `EventSummary` — ce que porte la collection : titre, type, dates, position,
  classeurs, personnages, et la **première** photo, seule chose qu'un marqueur
  ou une tuile affiche ;
- `HistoricalEvent = EventSummary & { description, photos }` — lu quand on
  ouvre une fiche.

L'héritage n'est pas décoratif : un événement complet passe partout où un
résumé est attendu, tandis qu'un résumé est **refusé** là où le tout est exigé.
Le formulaire d'édition n'accepte que `HistoricalEvent`, donc il est
impossible de le nourrir d'une photo sur cinq et de réécrire l'événement en
effaçant les quatre autres — le compilateur l'interdit.

Côté SQL, `event_photos` est trié et limité **dans la jointure**
(`event_photos.order=position&event_photos.limit=1`) : la base envoie une ligne
par événement au lieu de toutes pour qu'on les jette. Mesuré sur la collection
réelle : 1 292 → 696 octets par événement, soit **46 % de moins**, et l'écart
grandit avec les photos.

L'index qui porte la lecture principale suit cette même logique :
`events (user_id, start_year, start_month nulls first, start_day nulls first)`.
Il mène par le compte — puisque la policy filtre là-dessus avant tout — puis
reprend exactement l'ordre de tri demandé, `nulls first` compris, pour qu'une
année nue se lise avant les mois de la même année sans que Postgres ait à
retrier après coup.

Les données de référence (`places`, `polities`, `territories` et leurs
fragments) ne sont à personne : lecture pour tous, écriture par personne. Les
scripts de chargement utilisent la clé `service_role`, qui passe outre les
policies — et qui n'a rien à faire dans `.env`.

Le bucket `event-photos` reste public **en lecture** — une `<Image>` a besoin
d'une URL qui s'ouvre — mais l'écriture est cloisonnée par compte. Un seau n'a
pas de colonnes où accrocher un propriétaire : le compte est donc écrit dans le
chemin, `<user id>/events/<event id>/…`, `<user id>/characters/…`,
`<user id>/folders/…`, et les policies lisent ce premier segment
(`(storage.foldername(name))[1] = auth.uid()::text`). On écrit et on efface
sous soi, nulle part ailleurs — pas même à la racine du seau.

Reste vrai, et c'est assumé : un fichier est lisible par quiconque connaît son
URL. Les chemins contiennent des UUID, donc ils ne se devinent pas, mais une URL
partagée l'est pour de bon.

**Réglage à faire dans le tableau de bord Supabase** : *Authentication →
Sign In / Providers → Email*. Tant que « Confirm email » est coché, une
inscription attend un courriel de confirmation que le service d'envoi par
défaut ne délivre qu'aux adresses de l'équipe du projet. Pour un prototype,
décochez-le ; pour de vrai, configurez un SMTP.

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

### Tests

```bash
npm test          # une fois
npm run test:watch
```

Vitest, sur Node, sans simulateur ni réseau. Ce qui est couvert est la part de
l'application qui n'a besoin ni de l'un ni de l'autre : les règles d'une ligne
de généalogie (`events/rows.ts`), la géométrie des traits
(`genealogy/layout.ts`), l'arithmétique du déplacement et du zoom
(`genealogy/viewport.ts`), l'écriture et le tri des dates
(`events/historicalDate.ts`, `events/lifespan.ts`), les filtres
(`events/filtering.ts`) et la solidité d'un mot de passe (`auth/password.ts`).

Ces modules sont purs **par construction**, et c'est ce qui rend l'interface
autour d'eux réinscriptible sans crainte. Les composants React Native ne sont
pas testés : les monter demande un simulateur ou une montagne de doublures, et
ce qu'on vérifierait serait surtout que React fonctionne encore.

`.github/workflows/ci.yml` rejoue à chaque poussée les trois mêmes portes que
ci-dessus : types, tests, puis `expo export` — cette dernière étant la seule à
attraper un chemin faux ou un module absent, que le typage ne voit pas.

### React Native est compilé depuis les sources

`app.json` porte `expo-build-properties` avec
`ios.buildReactNativeFromSource: true`, et ce n'est pas un réglage de confort.

Expo SDK 56 livre par défaut un React Native **précompilé**
(`React.xcframework`). Son binaire de débogage n'exporte pas
`facebook::react::Sealable::Sealable()` — vérifié au `nm` : seul le `typeinfo`
y figure. Or le composant Fabric `MLRNCallout` de
`@maplibre/maplibre-react-native` appelle ce constructeur, et l'édition de
liens échoue :

```
Undefined symbols for architecture arm64
  facebook::react::Sealable::Sealable()
  referenced from: MLRNCalloutProps::MLRNCalloutProps() in libMapLibreReactNative.a
```

C'est pourquoi la build **Release** passait et la build **Debug** non : les
deux binaires précompilés n'exportent pas les mêmes symboles. Compiler React
depuis les sources règle les deux cas d'un coup. La contrepartie est le temps :
la première compilation prend une trentaine de minutes.

### Trois applications, un seul code

iOS identifie une application par son *bundle identifier*, pas par son nom :
deux builds qui le partagent sont la même app pour le téléphone, et la seconde
installée écrase la première — session comprise. `app.config.ts` donne donc à
chaque variante son identifiant, son nom et son schéma d'URL :

| variante | nom sur l'écran | identifiant | schéma |
|---|---|---|---|
| `development` | HistoryNote dev | `com.mapshistory.app.dev` | `mapshistory-dev://` |
| `preview` | HistoryNote test | `com.mapshistory.app.preview` | `mapshistory-preview://` |
| `production` | HistoryNote | `com.mapshistory.app` | `mapshistory://` |

La variante est choisie par `EXPO_PUBLIC_APP_VARIANT` : les profils d'`eas.json`
la posent pour les builds dans le nuage, `npm start` et `npm run ios` la posent
en local. Le préfixe `EXPO_PUBLIC_` est délibéré — **l'application lit la même
variable à l'exécution** (`src/config/env.ts`) pour reconstruire son propre
schéma, et renvoyer les liens de réinitialisation vers elle-même plutôt que
vers la version de l'App Store installée à côté.

Chaque schéma doit figurer dans *Authentication → URL Configuration →
Redirect URLs* côté Supabase.

### Construire pour distribuer (EAS)

`eas.json` décrit trois profils :

| profil | ce qu'il produit |
|---|---|
| `development` | une build de développement, avec le client Expo, distribuée en interne |
| `preview` | la même sans le client de développement — pour faire essayer l'app |
| `production` | la build soumise à l'App Store, **numéro de build incrémenté automatiquement** |

```bash
npx eas-cli login
npx eas-cli init          # une seule fois : relie le dépôt au projet EAS
npx eas-cli build --platform ios --profile production
```

**La version se gère à deux niveaux, et c'est volontaire.** `app.json` porte la
version affichée aux lecteurs (`1.0.0`) — c'est une décision éditoriale, on la
change à la main. Le numéro de build, lui, n'intéresse que l'App Store, qui
exige seulement qu'il augmente : `"appVersionSource": "remote"` et
`"autoIncrement": true` le font compter par EAS. Rien à retenir, rien à
oublier, et deux builds ne peuvent pas porter le même numéro.

**Les variables d'environnement ne voyagent pas avec le dépôt.** `.env` est
ignoré par Git, donc une build EAS ne le verra jamais. Il faut les déclarer une
fois côté EAS :

```bash
npx eas-cli env:create --name EXPO_PUBLIC_MAPTILER_API_KEY   --value "…" --visibility plaintext
npx eas-cli env:create --name EXPO_PUBLIC_SUPABASE_URL       --value "…" --visibility plaintext
npx eas-cli env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY  --value "…" --visibility plaintext
npx eas-cli env:create --name EXPO_PUBLIC_SENTRY_DSN         --value "…" --visibility plaintext
npx eas-cli env:create --name SENTRY_AUTH_TOKEN              --value "…" --visibility secret
```

Les quatre premières finissent de toute façon dans le bundle : les marquer
secrètes serait un mensonge. La cinquième, non — elle ne sert qu'à téléverser
les cartes de sources pendant la construction, et `secret` la rend illisible
même depuis le tableau de bord.

La section `submit` porte l'identifiant App Store Connect de l'app et celui de
l'équipe — deux identifiants publics, que n'importe qui peut lire dans une app
publiée. **L'identifiant Apple (l'adresse) n'y est pas**, et c'est délibéré :
ce fichier est versionné, et une adresse dans un dépôt est une adresse
moissonnée. `eas submit` la demande au moment de l'envoi, ou la lit dans la
variable `EXPO_APPLE_ID` :

```bash
EXPO_APPLE_ID="vous@exemple.fr" npx eas-cli submit --platform ios --profile production
```

### Autres commandes

```bash
npm start            # serveur Metro (dev build déjà installée)
npm run typecheck    # tsc --noEmit
npm run prebuild     # régénère ios/ et android/ de zéro
npm run textures     # régénère les textures parchemin
npm run icons        # rasterise assets/icons/src/*.svg → assets/icons/*.png
```

---

## 4. Structure

```
index.ts                          point d'entrée Expo
app.json                          config Expo + config plugin MapLibre
.env.example                      modèle de configuration
docs/territoires.md               marche à suivre du pipeline des frontières
scripts/generate-textures.mjs     génère les PNG de parchemin (sans dépendance)
scripts/extract-territories.mjs   lit les tuiles OHM → NDJSON
scripts/load-territories.mjs      NDJSON → table de transit
scripts/stitch-territories.sql    recollage + simplification → territories
scripts/extract-places.mjs        agglomérations OHM → JSON
scripts/load-places.mjs           JSON → table places
scripts/generate-icons.mjs        rasterise les icônes de type d'événement
assets/textures/                  paper-grain.png, vignette.png
assets/icons/src/*.svg            icônes d'interface, sources vectorielles
assets/icons/*.png                sortie de build, 192 px

src/
  App.tsx
  config/
    env.ts                        lecture/validation des variables d'env
    map.ts                        zooms, vue initiale, flags, attribution
  theme/
    palette.ts                    palette parchemin (carte + UI)
    tokens.ts                     espacements, rayons, ombres, typographie
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
        labels.ts                 toponymie
  lib/
    supabase.ts                   client (construit paresseusement)
    base64.ts                     décodeur pour l'upload des photos
  features/
    genealogy/
      TreeManager.tsx             la liste des arbres, dans la feuille Ajouter
      TreeBuilder.tsx             le constructeur plein écran
      TreeNode.tsx                un rond : photo, nom, dates, marque
      TreeMemberSheet.tsx         la place de quelqu'un : poids, marque, note
      layout.ts                   positions et coudes, pure et testable
    events/
      types.ts                    modèle de domaine
      api.ts                      requêtes Supabase
      historicalDate.ts           années signées, dates imprécises, formatage
      filtering.ts                importance effective + filtres
      cover.ts                    quelle image représente un événement
      lifespan.ts                 « 1769 – 1821 », « né en 1769 », « † 1821 »
      pickPhotos.ts               ouverture de la photothèque, partagée
      EventsProvider.tsx          état partagé (Context + hooks)
      components/
        EventMarkers.tsx          les trois marqueurs ancrés sur la carte
        EventMarker.tsx           le médaillon : photo, ou emoji du type
        EventFormModal.tsx        création et modification
        EventDetailModal.tsx      fiche complète, modifier, supprimer
        EventSummaryCard.tsx      tuile de résumé
        EventListView.tsx         la même tuile, empilée et défilante
        EventDateField.tsx        tuile de date, molettes, période
        TypePicker.tsx            rail des seize types
        PhotoViewer.tsx           photo plein écran + sa source
        FolderSelector.tsx        choix des classeurs + importance
        FolderManager.tsx         la liste des classeurs
        FolderEditModal.tsx       fiche d'un classeur : nom et couverture,
                                  en création comme en modification
        CharacterManager.tsx      la liste des personnages
        CharacterEditModal.tsx    fiche d'un personnage : nom, dates, portraits
        CharacterSelector.tsx     qui un événement met en scène
        PhotoPicker.tsx           sélection des photos
        LocationReticle.tsx       placement du lieu au réticule
        AddEventButton.tsx        le bouton +
    territories/
      TerritoryLayers.tsx         frontières historiques (Cliopatria / OHM)
      useTerritoriesAt.ts         cache par entité, pas par date
      api.ts                      les deux appels : identifiants, puis manquants
    places/
      PlaceLayers.tsx             agglomérations historiques
      usePlacesAt.ts              cache par date
      api.ts
    filters/
      FilterButton.tsx            le mot « Tous » en haut de l'écran
      FilterModal.tsx             classeurs + importance de chacun
    timeline/
      Timeline.tsx                règle d'années défilant sous une aiguille
  components/
    ui/                           système d'interface : Sheet, Paper, InkButton,
                                  SegmentedControl, SelectField, Chip…
    WorldMap/
      WorldMap.tsx                le composant carte, isolé
      ParchmentOverlay.tsx        grain de papier + vignettage
      MapAttribution.tsx          crédit MapTiler/OSM (obligatoire)
  screens/
    MapScreen/
      MapScreen.tsx               compose les deux vues, filtres, frise, modales
      ViewToggleButton.tsx        bascule carte ↔ liste
      MissingConfigNotice.tsx
```

### L'interface

**La carte est un atlas ancien ; la chrome posée dessus ne l'est pas.** Elle
suit les conventions mobiles actuelles — feuilles remontant du bas, rayons
généreux, élévation douce, cibles tactiles de 44 pt — en n'empruntant à la
planche que ses couleurs. C'est un contraste assumé : le document a l'air
ancien, l'application a l'air d'une application.

Les mesures vivent dans `src/theme/tokens.ts` — c'est ce qui empêche cinq
surfaces de dériver vers cinq styles. La seule survivance de la voix d'atlas
dans l'interface est `type.legend` : les petites capitales espacées des
intitulés de champ.

Les modales centrées ont laissé place à des **feuilles de bas d'écran**
(`Sheet`) : elles montent sous le pouce au lieu d'atterrir au milieu de l'écran,
avec poignée, en-tête et pied d'actions fixe. Elles se ferment **en tirant
l'en-tête vers le bas** — au-delà de 110 pt ou d'un geste vif.

L'animation est pilotée à la main (`Animated` + `PanResponder`, sans dépendance
native supplémentaire) plutôt que par `animationType="slide"` : celui-ci
translate **tout** le contenu de la modale, assombrissement compris, si bien que
le voile semblait monter avec le panneau. Il apparaît maintenant sur place en
160 ms pendant que seul le panneau glisse, et il s'éclaircit à mesure qu'on tire
la feuille vers le bas.

Seul l'**en-tête** est saisissable : revendiquer tout le panneau ferait
concurrence à chaque liste qu'il contient pour le même geste vers le bas. La
visionneuse de photo, elle, se balaie dans les deux sens — elle ne contient rien
qui défile.

Deux détails sans lesquels le glissement ne fonctionne pas, et qui m'ont coûté
un aller-retour :

- **`useNativeDriver: false` sur le panneau.** Une valeur confiée au driver
  natif cesse de repeindre de façon fiable quand `setValue` l'écrit depuis JS —
  or c'est exactement ce que fait un geste. La feuille refusait de suivre le
  doigt. Le fil JS est inoccupé pendant un glissement, le coût ne se voit pas.
- **`onStartShouldSetPanResponder: () => true`** sur l'en-tête, plus
  `onPanResponderTerminationRequest: () => false`. Attendre un seuil de
  mouvement laissait échapper les premiers pixels du geste, et rien ne
  revendiquait le responder.

Le fond est toujours un frère du panneau, jamais son parent — un `Pressable`
enveloppant vole le geste et empêcherait les listes de défiler.

### Décisions d'implémentation

- **Trois marqueurs au maximum, et ce sont de vraies photos.** La carte ne
  porte jamais plus que l'événement lu, le précédent et le suivant. Ce plafond
  est ce qui permet des `<Marker>` React — des vues ancrées, avec une image
  dedans — là où une collection entière aurait imposé une source GeoJSON et des
  glyphes plats. C'est un renversement assumé de la première version : le coût
  d'un marqueur riche ne se paie que trois fois.
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
  d'impression (papier → lavis → relief → eau → grille → texte). Une couche qui
  doit changer à l'exécution ne peut pas y vivre — le style est figé au
  chargement : elle se déclare en JSX avec `beforeId`, comme `TerritoryLayers`.
  Le `beforeId` choisit la strate : le lavis des territoires se glisse sous
  `water`, les pastilles de villes sous `label-ocean`.
- **Régions interactives, overlays** : `<WorldMap>` accepte des `children`
  MapLibre, comme `<EventMarkers>`. Rien à toucher dans `WorldMap.tsx`.
- **Suppression en masse, réorganisation des photos** : `updateEvent` remplace
  les liens de classeur en bloc plutôt que de les comparer un à un — l'ensemble
  est minuscule et un remplacement ne peut pas se désynchroniser. Le même moule
  vaut pour ce qui viendra.

---

## 5. Les événements historiques

**Ajouter.** Le bouton `+` en haut à droite ouvre le formulaire : titre,
description, date, photos, classeurs et lieu. « Placer sur la carte » masque le
formulaire, affiche un réticule fixe au centre — on déplace la carte pour
amener le lieu dessous — puis « Confirmer » revient au formulaire avec les
coordonnées, la saisie intacte.

**Dates.** Trois champs : jour, mois, année. Seule l'année est obligatoire ;
« 1453 » seul est une date valide. Une année négative (`-330`) ou suffixée
(`330 av`) signifie avant J.-C. L'emplacement pointillé sous les molettes ajoute
une date de fin, pour ce qui dure.

**Quatre sections sous le bouton `+`.** La feuille s'appelle *Ajouter* et une
bascule choisit ce qu'on ajoute : un **événement**, un **classeur**, un
**personnage** ou un **arbre** généalogique. Les deux moitiés restent montées, la cachée mise à `display: "none"`
— on peut passer à l'onglet classeur au milieu d'un formulaire à moitié rempli
et revenir sans avoir rien perdu.

La moitié *classeur* **est une liste et rien d'autre** : les classeurs
existants, avec le nombre d'événements rangés dans chacun, et en tête un
emplacement en pointillés portant un `+`.

**Créer un classeur et en modifier un sont le même acte** — un nom et une
couverture — donc c'est la même fiche, atteinte par l'emplacement du haut ou par
le crayon d'une ligne. Il y avait avant un champ et un bouton *Ajouter* épinglés
au-dessus de la liste : deux façons de dire la même chose, dont la plus rapide
ne savait pas donner de couverture. Un nouveau classeur peut désormais arriver
avec sa photo déjà dessus.

Rien n'y est écrit avant *Enregistrer*, **la photo comprise** :
elle est retenue comme un choix local plutôt que téléversée sur-le-champ, sans
quoi *Annuler* serait un mensonge — il défairait le nom et garderait l'image.
À la **modification**, la photo passe en premier : si le téléversement échoue,
le nom n'est pas touché non plus et la feuille reste ouverte sur ce qu'il y a à
corriger. À la **création**, c'est l'inverse, et ça doit l'être — le chemin de
stockage se construit sur l'identifiant du classeur, qui n'existe pas avant la
ligne. Une photo qui échoue après coup laisse donc un classeur sans couverture,
ce qui est dit et conservé plutôt que silencieusement annulé.

**Une corbeille en bas à gauche de la fiche supprime le classeur**, et seulement
en modification : il n'y a rien à supprimer qui n'existe pas encore. Comme pour
un événement, une action rare et irréversible n'a pas à occuper la place d'un
bouton courant. La confirmation dit ce qui va réellement se passer — combien
d'événements y sont rangés, et qu'ils **ne seront pas supprimés**, seulement
retirés de ce classeur. C'est la vérité de la base : `event_folders.folder_id`
est en `ON DELETE CASCADE`, donc les liens tombent et les événements restent.
Vérifié de bout en bout contre la vraie base, lien compris.

Les doublons de nom sont refusés, sans qu'un classeur compte contre lui-même —
sinon on ne pourrait jamais corriger sa propre casse. Et les liens
événement↔classeur portant l'identifiant et jamais le nom, renommer ne défait
rien.

**La photo de couverture est facultative** et n'a qu'un usage, décrit plus bas :
servir de repli au marqueur sur la carte et à la tuile de résumé. L'ancien
fichier n'est effacé qu'une fois la ligne pointée sur le nouveau — un objet
orphelin coûte quelques kilo-octets, une ligne qui pointe dans le vide coûte un
marqueur cassé au lecteur.

Modifier un événement n'a pas de seconde moitié : il n'y a rien à ajouter que
les changements qu'on a sous les yeux, donc la bascule disparaît.

**Personnages.** Un personnage porte un nom, des portraits, une date de
naissance, une date de mort et quelques lignes. Un événement en lie autant qu'il
en met en scène, et une même personne traverse autant d'événements qu'elle a
vécu — `event_characters` est une table de liaison comme `event_folders`.

Les dates d'une vie se saisissent avec **le contrôle qui sert aux dates d'un
événement** : une naissance et une mort sont un début et une fin. Seuls les mots
changent, passés en props — poser deux fois la même question avec deux
sélecteurs différents reviendrait à prétendre que ce sont deux questions
différentes. Les deux dates sont facultatives : on connaît des noms sans leurs
dates, et on connaît des vivants.

La base garde les mêmes règles que pour un événement — un jour exige son mois,
une partie de date exige son année, et `death_after_birth` refuse une mort
antérieure à la naissance. Supprimer un personnage le retire des événements sans
les supprimer : `event_characters.character_id` est en `ON DELETE CASCADE`,
comme ses portraits.

**Généalogie.** Un arbre est une *mise en scène* des personnages, pas une
propriété des personnages. Le même individu peut figurer dans plusieurs arbres
et n'y porter ni la même importance ni la même note — ce qu'on dit de Louis XIV
chez les Bourbons n'est pas ce qu'on en dit chez les Habsbourg. Tout ce qui
tient à une place dans un arbre vit donc sur le **membre**, jamais sur la
personne : le rang, la génération, le poids, la marque, le commentaire.

Le constructeur s'ouvre **en plein écran** — une généalogie est large et
profonde par nature, l'arranger par un hublot serait une punition. La toile
défile dans les deux sens, la chrome flotte au-dessus.

**Les `+` sont la seule façon d'ajouter quelqu'un.** Un rond en pointillés
ferme chaque rangée — au bout d'une rangée peuplée pour la même génération,
au-dessus de la première et en dessous de la dernière pour une génération de
plus. Un arbre vide n'en montre qu'un. Il n'y a pas de bouton « ajouter une
génération » ailleurs : la place où l'on touche *est* la place où la personne
apparaîtra.

Ce qui rend la chose possible, c'est que **les générations sont signées**.
Ajouter au-dessus de la première ne renumérote personne : c'est une rangée à
−1, et le cadre fait le décalage au moment du dessin. Renuméroter aurait été
une écriture par membre à chaque fois, et autant d'occasions de désynchroniser.

**Deux modes, et deux seulement.** Un appui ouvre la fiche de quelqu'un. En mode
**liaison** — où l'on entre depuis cette fiche — un appui ajoute ou efface un
trait du parent choisi vers celui qu'on touche. Pas de glissement, pas de geste
caché, et un bandeau dit en permanence dans quel mode on est et comment en
sortir. Un trait ne descend que vers une génération plus basse ; l'inverse est
refusé d'une phrase plutôt que dessiné.

**Les traits sont des rectangles.** React Native ne trace pas de diagonale sans
module natif, et une généalogie n'en veut pas : chaque lien est un coude en
trois segments — descente, traverse, descente. Quand un parent a plusieurs
enfants, les premières descentes se confondent et se lisent comme un seul tronc.
L'arithmétique vit dans `layout.ts`, à part et testable.

Chaque personnage est un rond photographique avec son nom et ses dates.
**L'importance atténue le dessin** — discret, normal, majeur — parce que c'est le
lecteur qui sait lequel des deux cousins compte. Un **emoji** signale une fin
précoce (maladie, poison, assassinat, bataille, exécution, accident, en bas âge),
et un point de cire au bord du portrait dit qu'il y a quelque chose d'écrit à son
sujet dans cet arbre.

**Classeurs et importance.** Dans le formulaire, le champ *Classeurs* ouvre une
liste déroulante — elle reste lisible quel que soit le nombre de sujets — et
**ne sert qu'à choisir**. Créer s'est déplacé dans l'autre moitié, pour que
ranger un événement ne se transforme jamais en inventer un sujet au milieu d'un
formulaire. Chaque classeur coché reçoit ensuite sa propre importance. C'est là
que se matérialise le modèle : un événement majeur pour un sujet et secondaire
pour un autre.

**Le formulaire est six questions, posées une par une.** *Ce qui s'est passé*,
*Quand*, *Où*, *Qui*, *Classement*, *Images* — une page chacune, *Enregistrer* ne
paraissant qu'à la dernière ; ailleurs c'est *Suivant*, et *Annuler* devient
*Retour* dès la deuxième. Chaque titre porte à sa droite la réponse en cours (le
type choisi, le nombre de classeurs).

Au-dessus, cinq segments qui se remplissent, « Étape 2 sur 5 » et le nombre
d'étapes restantes. Un assistant sans ça est un couloir sans fenêtres : on ne
peut pas savoir si le prochain appui termine le travail ou ouvre quatre pages de
plus.

**Ce qui manque est signalé à la sortie de l'étape concernée** — un titre vide
au bout de la première, une date au bout de la deuxième, un lieu au bout de la
troisième — et non à l'enregistrement, quatre pages plus loin que le champ dont
il est question. *Enregistrer* revérifie les cinq et ramène à la première étape
fautive, au cas où.

**Modifier un événement n'est pas un parcours.** C'est un changement, souvent le
quatrième ; faire traverser cinq pages pour l'atteindre serait une punition.
En modification, les cinq sections sont donc affichées d'un coup, comme avant, et
l'indicateur disparaît.

**Type.** Les seize types sont sur un rail d'emoji qu'on fait défiler
horizontalement : un geste au lieu de deux et d'une modale, et le choix reste
visible au repos au lieu d'être résumé dans une ligne grise. Le nom du type
choisi est écrit à côté du titre de section, pour que l'emoji n'ait jamais à
porter le sens tout seul.

**Importance.** Un titre *Importance* et un contrôle segmenté à trois choix,
dans la carte du classeur. Rien de plus.

Il y a eu deux tentatives avant, et elles sont instructives. Trois barres
montantes d'abord — l'importance est une *grandeur*, et un contrôle segmenté
donne le même poids à ses options, ce qui est en principe faux. Mais pour être
atteignables les barres demandaient 44 pt de haut chacune, et la carte devenait
plus haute que son contenu. Un curseur ensuite, qui réglait la hauteur mais pas
le fond : **toute commande qui se glisse à l'intérieur d'une feuille défilante
dispute le toucher à la liste, et sur iOS la liste gagne** — une `UIScrollView`
annule le toucher de ses enfants dès qu'elle voit le doigt bouger
(`canCancelContentTouches`), avant que le moindre seuil en JavaScript n'ait son
mot à dire. Geler la liste pendant le geste marchait en théorie et restait
poissseux en pratique.

Trois appuis valent mieux qu'un glissement qui marche quatre fois sur cinq.

**Le panneau de filtres emploie exactement le même contrôle**, à un choix près :
« Toutes » s'y ajoute en tête des trois, parce que filtrer admet une quatrième
réponse que composer n'admet pas. Le lien y est donc `Importance | null` — non
parce qu'un événement pourrait n'en avoir aucune, mais parce qu'un filtre le
peut. Un appelant qui n'offre pas « Toutes » ne peut jamais en recevoir.

**Classement.** Une carte par classeur, portant sa couverture, son nom et son
importance. Avant, les classeurs étaient une ligne de résumé grise et les échelles
une pile détachée en dessous : rien à l'écran ne disait laquelle allait avec
lequel. Or ce couplage *est* le modèle. Sous les cartes, un emplacement en
pointillés — une place à remplir, pas un bouton de plus.

**Photos.** Un rail de vignettes et une feuille derrière celle qu'on touche.
C'était un tableau : une ligne par photo, vignette, champ de source, croix. Juste
et sans joie — la source, qu'on remplit une fois sur cinq, occupait plus de place
que l'image. Les images sont maintenant le contrôle et la source attend derrière
un appui. Un petit point de cire au coin d'une vignette signale qu'elle a une
source, sans avoir à l'ouvrir.

**Dates.** La date se lit comme une date et non comme un champ : l'année dans le
plus gros corps du formulaire — c'est elle qui déplace les frontières — et le
reste en ligne discrète dessous, qui dit « Année seule » quand il n'y a rien de
plus. Un événement connu à l'année près doit avoir l'air délibéré, pas inachevé.

**Toute date peut être déclarée incertaine**, et s'écrit alors avec une vague :
`~1453`, `~mai 1453`, `~29 mai 1453`, `~44 av. J.-C.`. L'interrupteur est dans le
sélecteur, sous l'aperçu, et porte sur **la date qu'on est en train de régler** —
un événement peut commencer un jour connu et finir à une date approximative, une
vie avoir une naissance devinée pour une mort attestée. C'est donc un drapeau par
date, jusque dans le schéma : `start_approx`, `end_approx`, `birth_approx`,
`death_approx`.

Une seule fonction pose la vague, dans `historicalDate.ts`, et **toutes** les
écritures de date de l'application passent par elle — la fiche, la tuile de
résumé, la frise, les listes de personnages, les ronds d'un arbre. Une date ne
peut donc pas être incertaine dans la fiche et certaine sur le marqueur.

Le piège était ailleurs : les molettes **reconstruisaient** l'objet date pour
effacer un jour ou un mois (`{ year: state.year }`), ce qui aurait jeté le
drapeau à chaque tour de molette. Elles appellent maintenant `withoutDay` et
`withoutMonth`, qui nomment ce qu'elles retirent au lieu de repartir de zéro.

**Une seule commande pour une date ou une période.** Il y avait un interrupteur
*Période* sur le formulaire, qui demandait de déclarer la **forme** de la réponse
avant de la donner. La question est passée là où se trouve la réponse : la date
de fin s'offre **dans** le sélecteur, en emplacement pointillé sous les molettes,
et ce n'est qu'une fois ajoutée que deux segments *Début* / *Fin* apparaissent
pour passer de l'une à l'autre. La contrainte `end_after_start` de la base est
reproduite ici, pour qu'une période à l'envers soit refusée d'une phrase plutôt
que d'une erreur Postgres.

Derrière la tuile, le sélecteur est à trois molettes — jour, mois, année — et non le
sélecteur de date du système. Ce dernier a été écarté pour une raison de fond :
il ne sait exprimer *aucune* des trois choses que cette app stocke. Pas d'année
seule (« 1299 » deviendrait le 1ᵉʳ janvier 1299, une donnée fausse), pas de mois
sans jour, et pas d'année avant J.-C. Le tiret en tête des molettes jour et mois
est précisément ce qui laisse une date imprécise le rester. Un aperçu sous les
molettes montre la date en toutes lettres avant de valider.

**Sources des photos.** Chaque photo porte une source facultative — un lien ou
une référence libre. Dans la fiche, toucher une photo l'ouvre en grand
par-dessus, avec sa source en dessous ; quand c'est une URL, elle s'ouvre dans
le navigateur.

**Types.** Chaque événement porte un type parmi seize — naissance, mort,
mariage, sacre, bataille, conquête, traité, révolution, indépendance, loi,
construction, exploration, découverte, culture, catastrophe, autre.

**Le marqueur sur la carte et la tuile de résumé montrent la même image**, et
c'est la même fonction qui la choisit — `coverFor` dans `cover.ts`. Trois
possibilités, dans cet ordre : la **première photo de l'événement**, sinon la
**photo de couverture d'un de ses classeurs**, sinon l'**emoji de son type**,
comme le sélecteur et la fiche. Le type est ainsi dit d'une seule voix partout.

Quand un événement sans photo appartient à plusieurs classeurs pourvus d'une
couverture, le premier de la liste l'emporte. La liste étant triée par nom, le
choix est arbitraire mais **stable** — c'est tout ce qu'on lui demande.

Seize glyphes gravés tenaient auparavant ce rôle de repli sur la carte. Ils ont
été retirés avec leur registre : `assets/icons/` ne contient plus que les quatre
icônes d'interface — corbeille, crayon et les deux bascules de vue.

**Modifier.** La fiche complète porte *Modifier*, qui rouvre le formulaire
pré-rempli — y compris le lieu, qu'on peut redéplacer au réticule. Les photos
déjà stockées y apparaissent aux côtés des nouvelles ; en retirer une la
supprime de la table **et** du bucket à l'enregistrement. La suppression de
l'événement, elle, est passée en petite corbeille en bas à gauche : c'est une
action rare et irréversible, elle n'a pas à occuper la même place qu'un bouton
courant.

Le formulaire reçoit une `key` liée à l'identité de l'événement : changer
d'événement remonte le composant, et tous les champs se ré-amorcent sans effet
de bord.

**Territoires.** La carte porte les frontières telles qu'elles étaient **à la
date de l'événement lu** : passer d'un événement au suivant fait respirer les
empires.

Deux jeux sont en base et la carte sait lire les deux, par la même paire de
fonctions et avec les mêmes propriétés — une ligne de `src/config/map.ts`
choisit :

- **Cliopatria** (Seshat Global History Databank, CC BY 4.0), par défaut.
  12 043 versions de 1 540 polités, de 3400 av. J.-C. à 2024, à un seul rang
  politique. Moins d'un mégaoctet par date.
- **OpenHistoricalMap** (CC0). Tracés plus fins et surtout **noms d'époque en
  langue d'époque**, mais une couverture inégale dans le temps : aucun royaume
  de France entre 1051 et 1659, la période ayant été cartographiée fief par
  fief. Trois rangs politiques, dont les fiefs, qui n'apparaissent qu'au zoom
  pays — et seulement ceux qu'un souverain recouvrait, les autres étant le rang
  le plus haut de leur coin de carte.

Le choix se paie : Cliopatria remplit 1453 de la France à la Russie là où OHM
laissait une page blanche, mais il dit « Kingdom of France » quand OHM disait
« Reaume de France ». Ses identifiants Wikidata offrent une sortie — voir
[docs/territoires.md](docs/territoires.md).

**Le lavis passe sous la mer.** Cliopatria est digitalisé à un point tous les
25 km environ, si bien que ses littoraux ne suivent que grossièrement les vrais
et que la couleur déborde dans l'eau — mesuré à +5,2 % de surface pour le
Portugal, +9,3 % pour le Japon. Le calque `water` du style de base étant un
remplissage **opaque** dessiné avant celui-ci, il suffit de glisser le lavis
dessous (`beforeId="water"`) pour que la mer recouvre tout débordement, au
tracé exact des tuiles et à tous les zooms, sans un octet de plus. Les lacs
intérieurs cessent du même coup d'être peints.

Ce qui reste est le défaut inverse — un filet de côte sans coloris là où le
polygone s'arrête court. Le corriger demanderait un masque de terres et
multiplierait les sommets côtiers ; voir [docs/territoires.md](docs/territoires.md).

**Les couleurs sortent d'une coloration de carte**, pas d'un tirage au sort.
Deux polités qui se sont un jour touchées n'ont jamais le même lavis. La base
construit le graphe de voisinage — 6 464 arêtes entre 1 448 noms, degré maximal
120 — et `scripts/colour-polities.mjs` le colorie par DSATUR. Mesuré sur ce
graphe : quatre couleurs laissent 8,4 % des frontières invisibles, huit en
laissent une seule, **neuf n'en laissent aucune**. D'où les neuf lavis de
`palette.ts` — le neuvième, une pervenche, comble le seul vide de teinte large
que les huit autres laissaient.

C'est par **nom** et non par version : un empire garde sa couleur pendant que
ses frontières bougent, donc faire défiler la frise ne repeint pas la carte.

Les données ne viennent **pas** de leurs tuiles à l'exécution, et c'est
l'enseignement du sujet : une tuile z4 sur l'Europe contient 3 316 entités, soit
toute frontière ayant jamais existé là. On en affiche une trentaine à une date
donnée, et décoder le reste suffisait à faire évincer l'app par iOS. Elles sont
donc extraites une fois hors ligne, recollées et simplifiées en base, et l'app
en lit une tranche par date — quelques centaines de kilo-octets, chaque polygone
ne transitant qu'une fois par session grâce à un cache par entité.

**Les noms des territoires sont ceux de leur époque**, tirés d'OpenHistoricalMap
et dessinés depuis nos propres données : « Francia occidentalis » en 900, pas
« FRANCE ». Ils sont dimensionnés par l'aire du polygone, comme un atlas donne
de plus grandes lettres à un empire qu'à un duché, et posés sur une ancre
unique par entité — sans quoi MapLibre nommerait chaque île d'un archipel. Beaucoup ne sont pas en
écriture latine — الْخِلَافَة الْعَبَّاسِيَّة, መንግሥተ አክሱም — et MapTiler sert bien les
glyphes correspondants (135 ko d'arabe, 147 ko d'éthiopien pour la pile
« Noto Sans Bold »), son serveur assurant le repli sur la famille Noto.

**Les villes aussi sont celles de l'époque** — 23 279 agglomérations datées,
tirées d'OHM au zoom 6. À l'an 900 la carte affiche 平安京 et 徐羅伐, pas Kyoto
et Gyeongju. Villes à partir du zoom 3, bourgs à partir de 5,5.

**Il n'y a aucune frontière, aucun toponyme politique ni aucune ville moderne
sur cette carte.** Les seuls tracés
politiques sont les territoires historiques : jamais deux époques à la fois. Les
couches `label-country` et `label-region` ont donc quitté le style au même titre
que les frontières. Là où OpenHistoricalMap ne couvre rien, la planche reste
sans frontière ni nom de pays, ce qui est le comportement voulu. Le fond MapTiler ne sert donc qu'au relief, à
l'hydrographie, au couvert végétal et à la toponymie.

**Le pipeline, ses réglages et sa marche à suivre sont dans
[docs/territoires.md](docs/territoires.md)** : les trois scripts, le SQL de
recollage, les mesures et les limites connues.

Se coupe dans `MAP_FEATURES.territories`.

**Deux vues.** Le bouton en haut à gauche remplace la carte par une liste
défilante des mêmes tuiles, et inversement. Il montre toujours la vue vers
laquelle il mène, jamais celle où l'on est. Filtres, bouton `+` et frise sont
communs aux deux : ce sont deux fenêtres sur la même sélection, et avancer d'un
événement dans l'une fait défiler l'autre.

Les deux scènes restent **montées** en permanence, la cachée mise à
`display: "none"`. Démonter la carte reviendrait à jeter le cadrage que vous
aviez posé et à retélécharger ses tuiles à chaque bascule. Dans la vue liste, la
tuile de résumé au-dessus de la frise disparaît — elle ferait doublon — et
l'événement courant est cerné de cire dans la liste à la place.

**Filtrer.** Un seul mot en haut de l'écran, « Tous » par défaut, qui prend le
nom du classeur choisi ou compte ceux qui le sont. Il ouvre une popup : la même
liste déroulante de classeurs, puis pour chaque classeur coché son importance,
« Toutes » par défaut. Plusieurs classeurs se cumulent en union — leurs
événements s'additionnent. Le filtre pilote la carte *et* la frise.

**Parcourir.** La carte ne montre jamais plus de trois événements : celui qu'on
lit, cerné de cire, le précédent estompé et le suivant assombri. À l'arrêt entre
deux événements il n'en reste que deux, ceux qui encadrent l'année. Au
lancement, le plus ancien de la période filtrée est sélectionné d'office, sans
animation de caméra.

**La frise du bas est une règle d'années qui défile sous une aiguille fixe.**
C'est le modèle de l'application : sa source de vérité est **l'année lue**, pas
l'événement sélectionné.

Elle tenait auparavant toute la période filtrée entre deux bouts, ce qui faisait
dépendre son échelle de ce qui se trouvait à l'écran — un siècle valait la
largeur d'un doigt à un moment et la planche entière au suivant. **L'échelle est
maintenant fixe : trois cents ans à l'écran**, soit 1,3 pt par an et 130 pt par
siècle, et c'est la règle qui voyage. Le geste veut donc dire la même chose à
chaque fois, et l'essentiel de l'histoire est hors champ **à dessein**, à portée
de balayage.

**Son étendue est fixe elle aussi, et volontairement indépendante des
événements** : `-3000 à 2100`, dans `src/config/history.ts`. Elle se déduisait
auparavant des dates extrêmes des événements, avec une marge — si bien qu'une
application sans événement n'avait pas de frise du tout, et que la carte perdait
ses frontières avec elle. Or les événements sont des marques **sur** une règle,
pas ce qui la fait exister. Sans aucun événement, la frise s'ouvre sur l'an
2000 : pas sur la date du jour, puisque les frontières s'arrêtent en 2024 et
qu'ouvrir sur le présent afficherait un monde vide qui se lirait comme une
panne.

Le même intervalle sert aux molettes du sélecteur de date, qui allaient jusqu'à
2200 de leur côté — une date qu'on pouvait saisir mais jamais atteindre au
balayage était une contradiction silencieuse.

```
                1453
   ·      ·      ┃      ·          ·      ← marqueurs d'événements
 │ │ ┃ │ │ │ │ │ ┃ │ │ │ │ │ ┃ │ │ │ │    ← petits traits tous les 10 ans,
                                             gros tous les 100
```

**Pas de carton derrière** : des traits posés sur la planche, qui s'éteignent en
fondu sur les 96 derniers points de chaque bord — une échelle gravée sur la
carte plutôt que collée dessus. Le fondu est calculé par trait, sans dégradé ni
dépendance supplémentaire, puisque les traits sont de toute façon dessinés un
par un. L'année lue est écrite au-dessus du centre, les marqueurs d'événements
entre elle et la règle.

On peut s'arrêter **où l'on veut, y compris sur une année où rien ne s'est
produit** — les frontières et les villes se redessinent quand même, ce qui est
l'essentiel de l'intérêt.

| | |
| --- | --- |
| `SPAN = 300` | années à l'écran. L'échelle, et elle ne bouge jamais. |
| `SNAP = 14` | points : à cette distance de l'aiguille, un événement est « lu ». Soit une dizaine d'années à cette échelle. |
| `COMMIT_MS = 180` | la carte suit, mais chaque nouvelle année est un aller-retour pour les frontières. |
| `FRICTION = 0.94` | l'amortissement du lancer, par image à 60 Hz. |

**Le lancer et le magnétisme se contredisent, donc ils ne coexistent pas.**
Pendant le glissement, l'aiguille est attirée par un marqueur qui passe à moins
de 14 points — c'est ce qui empêche l'année que dessine la carte et l'événement
que nomme la tuile de diverger d'une décennie. Pendant le lancer, le magnétisme
est coupé : une règle qui s'accrocherait à chaque marqueur survolé hoquetterait
au lieu de filer. Il est rallumé pour la dernière image, pour qu'un lancer qui
s'achève près d'un événement se pose dessus et non à côté.

La position du lancer est portée par une variable locale et non relue depuis
l'état React : une image ne doit pas dépendre du fait que React ait rendu depuis
la précédente.

Ouvrir un événement — sur la carte ou sur la frise — recentre la planche **sans
changer le zoom** et fait apparaître une tuile de résumé ; la tuile ouvre la
fiche complète.

**Un chevron flanque cette tuile** et passe à l'événement suivant. La frise
parcourt les **années**, celui-ci parcourt les **événements** — c'est l'autre
chose qu'un lecteur veut faire, et il est posé contre la tuile qu'il fait
avancer plutôt qu'au bord de l'écran comme l'étaient les anciennes flèches. Il
s'éteint sur le dernier événement de la période filtrée.

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

**L'app se ferme immédiatement, sans rien dans le terminal Metro.**
C'est un crash natif : le JS n'a pas la main, donc rien ne remonte à Metro. Le
log est côté appareil — branchez l'iPhone et lancez depuis le Mac :

```bash
xcrun devicectl device process launch --device <UDID> --console \
  --terminate-existing com.mapshistory.app
```

Deux causes déjà rencontrées, toutes deux dans les couches MapLibre :

- `"zoom" expression may only be used as input to a top-level "step" or
  "interpolate" expression` — une expression de zoom **doit être l'expression la
  plus externe** d'une propriété. La glisser dans un `["*", …]` ou un `["+", …]`
  fait planter le rendu au chargement du style.
- `Only one zoom-based "step" or "interpolate" subexpression may be used` — même
  famille : une propriété n'admet **qu'une seule** expression de zoom. Brancher
  d'abord sur la donnée puis mettre un `step` dans chaque branche en produit
  deux. Dans les deux cas le remède est identique : l'expression de zoom au
  sommet, le test sur la donnée *à l'intérieur* de chaque palier.
- `FilterPropsConversions.h: react_native_expect failure: isMap` — la prop
  `filter` de `<Layer>` entre en collision avec la prop de style `filter` de
  React Native (les filtres CSS). Exprimez la condition dans la peinture
  (`["case", ["get", "x"], a, b]`) plutôt que dans un `filter` de couche.

Ces expressions se vérifient hors appareil avec `validateStyleMin` de
`@maplibre/maplibre-gl-style-spec` — il rend exactement le message d'erreur du
crash, dans les deux cas ci-dessus. Le style de base est validé ainsi ; les
couches déclarées en JSX (`EventMarkers`, `TerritoryLayers`, `PlaceLayers`)
échappent en revanche à ce contrôle automatique. **Les deux plantages de ce
type sont venus de là** : validez-les à la main avant de déployer.

**Un libellé n'apparaît pas alors que la donnée est bien là.**
MapLibre place les symboles en partant de la couche la **plus haute** de la
pile : le premier arrivé prend la place, les suivants qui la chevauchent sont
purement et simplement supprimés. L'ordre de montage des composants dans
`MapScreen` fixe donc la priorité — `PlaceLayers` avant `TerritoryLayers` pour
que le nom du pays l'emporte sur les noms de villes qui entourent son ancre.
Corollaire : un symbole rendu invisible par une opacité nulle **occupe quand
même sa boîte de collision**. Pour le retirer vraiment du calcul, videz son
`text-field` (`["step", ["zoom"], "", …]`) — un symbole sans texte ni icône
n'entre jamais dans le bucket.

**Une liste ou une molette refuse de défiler dans une popup.**
Le contenu de la feuille est enveloppé dans un `Pressable` — celui qui sert
à absorber les taps pour qu'un appui à l'intérieur ne referme pas la popup. Ce
`Pressable` gagne le *touch responder* et le `ScrollView` ou la `FlatList` qu'il
contient ne voit jamais le geste. Le remède : faire du fond un **frère** et non
un parent.

```tsx
<View style={styles.backdrop}>
  <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
  <View>{/* la feuille, sans enveloppe pressable */}</View>
</View>
```

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

- Build iOS device : **réussie**, `MapLibre.framework` embarqué.
- `npm run typecheck` et `npx expo export` : OK (782 modules).
- Schéma Supabase appliqué, `get_advisors` (sécurité) : aucune alerte.
- Chaîne complète vérifiée à travers RLS avec la clé publishable : lecture,
  écriture, modification, rejet des dates incohérentes, aller-retour du type et
  de la source des photos.
- Territoires : **Cliopatria seul**, 27 Mo. Les 76 Mo d'OpenHistoricalMap ont
  été supprimés de la base une fois Cliopatria devenu la source — la base passe
  de 130 à 54 Mo sur les 500 du plan gratuit. Ils se reconstruisent avec
  `scripts/extract-territories.mjs` puis `scripts/load-territories.mjs` : c'est
  un cache d'une extraction publique, pas une donnée unique. Chaîne RPC
  revérifiée après la suppression : 130 entités en 1453, 189 en l'an 2000,
  géométrie de 120 d'entre elles en moins de 600 ms. Voir
  [docs/territoires.md](docs/territoires.md).
- Sept événements de démonstration sont en base (987 à 1812), supprimables
  depuis la fiche de chacun.
- **Comptes** : un seul compte existe, celui de l'auteur, et il détient la
  collection créée avant l'arrivée des comptes — 38 événements, 3 classeurs,
  8 personnages, 1 arbre, 69 photographies. Aucun identifiant n'est écrit ici :
  le compte de test qui servait pendant la mise en place a été renommé puis
  doté d'un mot de passe choisi par son propriétaire, via le parcours de
  réinitialisation de l'application. Cloisonnement vérifié de bout en bout avec
  la clé publishable : la base estampille le propriétaire, un compte ne peut pas
  écrire au nom d'un autre, un visiteur non connecté ne lit ni ne supprime rien,
  et le dépôt d'une photo lui est refusé alors que la lecture par URL
  fonctionne.

  Une note pour la suite : `test@gmail.com` est refusé par Supabase à
  l'inscription — sa validation applique les règles de Gmail, qui exigent six
  caractères avant le `@`. Ce n'est pas un défaut de l'application.
- **Suppression de compte** : disponible dans la carte du compte (bouton
  profil → « Supprimer le compte »), avec ressaisie du mot de passe. L'ordre
  compte — les photos du seau d'abord, tant qu'une session peut encore les
  effacer, puis `delete_own_account()`, une fonction `security definer` qui ne
  supprime jamais que `auth.uid()` ; tout le reste suit par
  `on delete cascade`.
- **Mot de passe oublié** : depuis l'écran de connexion. Le lien revient dans
  l'application par le schéma `mapshistory://reset`, en flux **PKCE** — le lien
  ne porte qu'un code, inutilisable sans le vérificateur que ce téléphone a
  gardé. Deux conséquences : la demande et l'ouverture du lien doivent se faire
  **sur le même appareil**, et `mapshistory://reset` doit figurer dans
  *Authentication → URL Configuration → Redirect URLs* du tableau de bord,
  faute de quoi Supabase renvoie silencieusement vers le site du projet.
  L'envoi passe par le service de courriel intégré, plafonné à quelques
  messages par heure : pour de vrai, il faudra un SMTP.
- **Images** : chaque photo est ramenée à 1600 px de côté et réencodée en JPEG
  avant l'envoi (`src/features/events/shrink.ts`) — environ un cinquième du
  poids, et plus de HEIC dans le seau. Servir en plus des vignettes demanderait
  les transformations d'images de Supabase, qui sont réservées au plan payant.
- **Rapports de plantage** : Sentry, branché dans `src/lib/monitoring.ts` et
  démarré depuis `index.ts` avant le premier composant. Ce qui part : l'erreur,
  sa pile, l'écran concerné et l'**identifiant** du compte — jamais son adresse,
  jamais son IP (`sendDefaultPii: false`), et aucune mesure de performance
  (`tracesSampleRate: 0`, quota séparé). Sans `EXPO_PUBLIC_SENTRY_DSN`, rien
  n'est envoyé et rien d'autre ne change. La carte du compte porte, **en build
  de développement seulement**, un bouton qui provoque une vraie erreur de
  rendu : un dispositif de surveillance qu'on ne peut pas exercer est un
  dispositif dont on ignore qu'il est cassé.
- **Écran blanc** : `src/components/ErrorBoundary.tsx` entoure toute
  l'application. Une exception de rendu affiche désormais un écran lisible avec
  le message d'erreur et un bouton « Réessayer » qui remonte l'arbre à neuf.
- `@react-native-async-storage/async-storage` est une nouvelle dépendance
  native : **il faut reconstruire l'application** (`npx expo run:ios`) pour que
  la session survive à la fermeture. Sans reconstruction l'app fonctionne, mais
  redemande le mot de passe à chaque lancement.
- **Distribution** : `eas.json` en place (trois profils, numéro de build
  incrémenté par EAS). Manquent encore, et seulement le jour de la soumission :
  un compte développeur Apple pour remplir la section `submit`, les variables
  d'environnement déclarées côté EAS, et une politique de confidentialité.
- **Tests** : 81, sur 7 fichiers, en moins d'une seconde — voir la section
  Tests. Ils ne couvrent que les modules purs ; l'interface reste jugée à
  l'œil.
- Le rendu n'a jamais été jugé autrement que par son auteur : la palette de
  `src/theme/palette.ts` reste le premier endroit à ajuster.
