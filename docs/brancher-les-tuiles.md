# Brancher HistoryNote sur nos propres tuiles

À faire quand `docs/construire-les-tuiles.md` a rendu une adresse HTTPS qui
répond `206` à une requête de plage. Rien avant : tant que l'archive n'existe
pas, il n'y a rien à brancher.

---

## Pourquoi, en chiffres

Mesuré en démontant le protobuf de vraies tuiles MapTiler, calque par calque —
la part de chaque tuile que notre style **dessine réellement** :

| zoom | tuile | dont `place` | dessiné | part utile |
|---|---|---|---|---|
| z1 | 262 Ko | 150 Ko | 49 Ko | 19 % |
| z3 | 786 Ko | 572 Ko | 38 Ko | 5 % |
| z5 | 1466 Ko | 1079 Ko | 16 Ko | **1,2 %** |
| z7 | 487 Ko | 218 Ko | 111 Ko | 23 % |
| z10 | 118 Ko | 38 Ko | 58 Ko | 49 % |

`place` pèse jusqu'à 74 % d'une tuile et ne sert qu'à **un** calque,
`label-continent`, filtré sur `class = continent` et plafonné à z4 : un
mégaoctet de villes et de hameaux par tuile pour écrire sept mots.

Le coût, lui, se compte en requêtes et non en octets :

| requêtes/mois | MapTiler Flex | R2 |
|---|---|---|
| 500 000 | incluses | gratuit |
| 5 millions | 675 $/mois | gratuit |
| 50 millions | ~7 400 $/mois | ~18 $/mois |

**Le déclencheur, décidé d'avance** : 300 000 requêtes par mois, ou la première
ligne de dépassement sur une facture. Pas « quand ça marchera bien ».

---

## Les calques, et une mauvaise surprise

### ⚠️ `globallandcover` n'existe pas hors de chez MapTiler

**Mesuré le 2 octobre 2026, à l'essai à blanc.** Le portage Java d'OpenMapTiles
qu'utilise Planetiler n'a **pas de `GlobalLandcover.java`** — ce calque est
produit par MapTiler avec une source raster qui ne fait pas partie des quatre
entrées de Planetiler. Une archive construite par nous ne l'aura jamais.

Et `Landcover`, lui, ne couvre pas la même plage :

| zoom | d'où vient le couvert, chez Planetiler |
|---|---|
| z0–6 | **glaciers et banquise seulement** (Natural Earth) |
| z7+ | les polygones OSM — bois, prés, cultures, sable, marais |

**Conséquence concrète** : le calque `globallandcover-wash` ajouté au style le
1er octobre ne dessinera **rien** sur nos propres tuiles. De z0 à z6 les
continents redeviendront du parchemin nu, la glace exceptée — exactement
l'aspect d'avant cette modification. À partir de z7, les aplats reviennent par
`landcover`.

Trois façons de vivre avec :

1. **L'accepter.** C'est l'aspect qu'avait la carte jusqu'au 1er octobre, et il
   plaisait. Le papier et les aplats de territoires portent l'échelle mondiale.
2. **Garder MapTiler pour le fond** et ne rien auto-héberger. La couleur à
   l'échelle du monde est, littéralement, ce qu'on paye.
3. **Fabriquer le wash de bas zoom nous-mêmes** depuis Natural Earth, qui est
   déjà l'une des quatre sources téléchargées et relève du domaine public.
   Demande un profil Planetiler sur mesure, en Java : du vrai travail.

Le calque reste donc en place dans `land.ts` — il fonctionne aujourd'hui, sur
les tuiles de MapTiler. Il faut seulement savoir qu'il s'éteindra le jour du
basculement.

---

## Les cinq calques, et d'où ils viennent

La liste passée à `--only-layers` n'est pas un choix de confort : c'est
l'inventaire exact des `source-layer` que le style lit. Relevé ainsi :

```sh
grep -rho '"source-layer": *"[a-z_]*"' src/ | sort -u
```

Aujourd'hui :

| calque | lu par | fichier | auto-hébergeable |
|---|---|---|---|
| `water` | fonds et contours d'eau | `layers/water.ts` | oui |
| `waterway` | rivières | `layers/water.ts` | oui |
| `water_name` | noms d'océans et de lacs | `layers/labels.ts` | oui |
| `landcover` | aplats de terre | `layers/land.ts` | oui, à partir de z7 |
| `globallandcover` | aplats de terre, z0–9 | `layers/land.ts` | **non — voir ci-dessus** |
| `mountain_peak` | noms de sommets | `layers/labels.ts` | oui |

D'où la liste à passer à `--only-layers`, qui en compte **cinq** :

```
water,waterway,landcover,water_name,mountain_peak
```

⚠️ **`place` n'y est pas, et c'est un choix.** Il ne servait qu'aux sept noms de
continents sous z4. Deux conséquences :

1. Dans l'archive, **`label-continent` n'aura plus de données**. Les noms de
   continents disparaîtront.
2. Si on les veut, le remplacement est un petit GeoJSON local de sept points —
   exactement comme `createGraticule()` fabrique déjà la grille. C'est même
   mieux pour un atlas : le cartographe place « EUROPE » où il veut, pas au
   centroïde OSM.

**Si le style gagne un `source-layer` un jour, cette liste est à mettre à jour
et l'archive à reconstruire**, sinon la carte perd silencieusement un calque.
C'est le seul couplage fragile de tout le dispositif.

---

## 1. La variable

`.env.example` :

```
# Archive PMTiles de notre fond de carte. Vide = on retombe sur MapTiler.
EXPO_PUBLIC_TILES_URL=
```

`.env` (non versionné) : l'adresse réelle.

`src/config/env.ts`, à côté des autres lectures :

```ts
const tilesUrl = process.env.EXPO_PUBLIC_TILES_URL?.trim() ?? "";
```

et dans l'objet `env` exporté :

```ts
  tilesUrl,
  hasOwnTiles: tilesUrl.length > 0,
```

Le préfixe `EXPO_PUBLIC_` est obligatoire et la notation doit rester en point
statique — `process.env[nom]` n'est pas remplacé par le bundler. C'est déjà
documenté en tête de `env.ts`.

---

## 2. La source

`src/map/style/sources.ts`. Le type d'options gagne un champ :

```ts
export type SourceOptions = {
  apiKey: string;
  relief: boolean;
  graticule: boolean;
  /** Notre propre archive PMTiles, si nous en avons une. */
  tilesUrl: string;
};
```

et `createSources` choisit :

```ts
  const sources: Record<string, SourceSpecification> = {
    [SOURCE.base]:
      tilesUrl === ""
        ? {
            type: "vector",
            tiles: [`${MAPTILER_HOST}/tiles/v3/{z}/{x}/{y}.pbf?key=${apiKey}`],
            minzoom: 0,
            maxzoom: TILE_MAX_ZOOM,
            attribution: ATTRIBUTION,
          }
        : {
            type: "vector",
            // MapLibre Native lit `pmtiles://` nativement depuis iOS 6.10 ;
            // nous sommes en 6.26 (voir Package.resolved). Il va chercher des
            // tranches d'octets dans le fichier unique et lit le maxzoom dans
            // l'en-tête de l'archive — donc pas de `maxzoom` à répéter ici.
            url: `pmtiles://${tilesUrl}`,
            attribution: ATTRIBUTION,
          },
  };
```

Puis `src/map/style/createOldAtlasStyle.ts` passe la valeur :

```ts
    sources: createSources({ apiKey, relief, graticule, tilesUrl }),
```

avec `tilesUrl` ajouté à ses propres options, par défaut `env.tilesUrl` — même
motif que `relief = MAP_FEATURES.relief`.

Rien à changer dans `WorldMap.tsx` : le style y est construit une fois dans un
`useMemo` à dépendances vides, ce qui reste juste.

---

## 3. Ce qui ne change pas, et pourquoi

**Les polices restent chez MapTiler.** Vérifié à leur grille tarifaire :
TileJSON, Style JSON et fonts **ne sont pas facturés**. Les déplacer ne
rapporterait rien et coûterait un travail d'extraction de glyphes.

**Le relief reste chez MapTiler**, plafonné à `RELIEF_MAX_ZOOM = 7`. À ce
plafond, le monde entier ne compte que **21 845 tuiles** d'élévation — soit
quelques milliers de requêtes par lecteur, une fois pour toutes, puis le cache.
Ça ne vaut pas la peine de l'auto-héberger. Si on change d'avis un jour, un
modèle d'élévation libre à z0–7 tient dans un PMTiles minuscule, et MapLibre
accepte `encoding: "terrarium"` sur une source `raster-dem`.

**L'attribution, elle, doit changer.** Et ce n'est pas optionnel : l'outil
imprime la clause à chaque exécution, et l'archive la porte dans ses
métadonnées. Les tuiles produites sont sous **CC-BY** accordée par l'équipe
OpenMapTiles, et la mention visible exigée est, mot pour mot :

> © OpenMapTiles © OpenStreetMap contributors

Il faut donc **ajouter `"© OpenMapTiles"`** à la constante `ATTRIBUTION` de
`config/map.ts` le jour du basculement. « © MapTiler » reste justifié tant que
le relief et les polices en viennent.

---

## 4. Vérifier

```sh
npx tsc --noEmit && npm test
npx expo start -c      # le `-c` n'est pas optionnel : changer une variable
                       # EXPO_PUBLIC_ n'invalide pas le cache Metro tout seul
```

Sur le téléphone, dans cet ordre :

1. **Si l'archive ne couvre pas le monde entier**, se placer d'abord sur la
   zone construite. Le reste sera **vide** — c'est normal, pas une panne.
2. Côtes, lacs et aplats de couvert doivent apparaître comme avant.
3. Descendre jusqu'à z11 : le suréchantillonnage au-delà de z10 doit tenir.
4. Vérifier que les noms d'océans, de lacs et de sommets sont là — ce sont les
   trois calques d'étiquettes, et les plus faciles à perdre par un
   `--only-layers` incomplet.
5. Les noms de continents sous z4 : **absents**, voir plus haut.
6. Couper le réseau après avoir regardé une zone : elle doit rester affichée.

**Carte blanche sur une zone censée être couverte** → le problème est presque
sûrement l'adresse ou la requête de plage, pas le code. Refaire le `curl` de
l’étape 10 du fichier de construction avant de chercher ailleurs.

---

## 5. Retours en arrière

Chaque étape se défait en une ligne, et c'est le but du drapeau :

| Si | Alors |
|---|---|
| La carte est blanche | vider `EXPO_PUBLIC_TILES_URL` → retour à MapTiler |
| R2 déçoit | remettre une autre adresse dans la variable |
| Un calque manque | reconstruire l'archive, l'adresse change, la variable aussi |
| L'idée entière déçoit | vider la variable ; le chemin MapTiler n'a jamais été retiré |

Le code MapTiler n'est pas supprimé mais mis en second : c'est délibéré, et ça
coûte une branche `ternaire` dans un seul fichier.

---

## 6. Après, et seulement après

Une fois la carte dessinée depuis notre propre archive :

- **Restreindre la clé MapTiler** ne change pas : elle sert encore au relief et
  aux polices. La restriction d'User-Agent en place (`HistoryNote`) reste
  valable — voir la note de mémoire sur le sujet.
- **Agrandir le cache ambiant**, qui devient le dernier levier :
  `OfflineManager.setMaximumAmbientCacheSize()`. Le défaut de 50 Mo ne tenait
  qu'une poignée de tuiles MapTiler à 300–700 Ko ; avec des tuiles filtrées à
  20–60 Ko il en tiendra des centaines, et le relever à 250 Mo rend une visite
  de retour presque gratuite.
- **Mesurer un vrai mois** avant de conclure quoi que ce soit sur le trafic.
  Les chiffres de développement ne valent rien : chaque réinstallation d'un
  build vide le cache.
