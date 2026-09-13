# Les territoires et les villes historiques

Comment les frontières arrivent sur la carte, et comment étendre ou refaire la
couverture.

---

## Deux jeux de frontières, un interrupteur

La carte sait lire deux sources. Elles passent par la **même paire de
fonctions** et exposent les **mêmes propriétés**, si bien que la couche MapLibre
ignore laquelle elle dessine. Le choix tient en une ligne de
`src/config/map.ts` :

```ts
export const TERRITORY_SOURCE: "cliopatria" | "ohm" = "cliopatria";
```

| | Cliopatria | OpenHistoricalMap |
| --- | --- | --- |
| table | `polities` — 27 Mo | `territories` — 76 Mo |
| enregistrements | 12 043 versions de 1 540 polités | 8 765 versions |
| étendue | 3400 av. J.-C. → 2024 | toutes époques |
| rangs politiques | un seul | trois (`admin_level` 2, 3, 4) |
| une date en 1453 | 130 polités, 0,39 Mo | 278 entités, 1,29 Mo |
| une date en 2000 | 189 polités, 0,88 Mo | 237 entités, 3,00 Mo |
| noms | savants, en anglais | **d'époque, en langue d'époque** |
| licence | CC BY 4.0 | CC0 |

**Pourquoi Cliopatria par défaut.** OHM est inégal dans le temps : la fin du
Moyen Âge y est cartographiée fief par fief, sans les royaumes au-dessus. Il n'y
a **aucun royaume de France entre 1051 et 1659**, ni Saint-Empire, ni
Pologne-Lituanie, ni Hongrie en 1453. Cliopatria est un jeu savant, cohérent
d'un bout à l'autre : à la même date il donne le royaume de France, le duché de
Bourgogne, la maison de Jagellon, l'Empire ottoman, la Horde d'or, le khanat de
Crimée, et jusqu'à la principauté d'Orange (141 km²). Il est aussi **cinq fois
plus léger par date**, ses tracés étant généralisés à une échelle savante plutôt
que relevés au cadastre.

**Ce qu'on perd.** Les noms. OHM donne *Francia occidentalis*, *Rouantelezh
Breizh*, الْخِلَافَة الْعَبَّاسِيَّة — le nom que la polité se donnait, dans sa langue.
Cliopatria donne « Kingdom of France » et « Abbasid Caliphate ». En revanche
**13 760 de ses 13 765 enregistrements portent un identifiant Wikidata**, d'où
l'on pourrait tirer le nom natif et ses traductions : ce serait du même coup
l'interrupteur multilingue laissé de côté.

---

## Le pipeline Cliopatria

Deux étapes, pas trois : la géométrie arrive entière, donc rien à recoller.

```bash
curl -sLO https://raw.githubusercontent.com/Seshat-Global-History-Databank/cliopatria/main/cliopatria.geojson.zip
unzip cliopatria.geojson.zip
node --max-old-space-size=6144 scripts/load-cliopatria.mjs cliopatria_polities_only.geojson
# puis, dans le SQL Editor :
\i scripts/build-polities.sql
```

Le fichier est un seul document JSON de 165 Mo — d'où le tas agrandi.

**Deux familles d'enregistrements sont écartées**, et toutes deux se
dessineraient par-dessus les polités qui les composent :

- `Type = "RELATION"` (385) — une vassalité, une allégeance, dont la géométrie
  est l'union des deux parties ;
- un `POLITY` au nom **entre parenthèses** (1 337) — la même union classée
  comme polité : « (Kingdom of France) », c'est la France *et* ses vassaux,
  quand « Kingdom of France » est le domaine royal seul.

Restent 12 043 enregistrements d'un seul rang politique, qui pavent la carte
sans se chevaucher. Vérifié sur le jeu entier : **zéro chevauchement** entre
versions successives d'une même polité, 10 089 enchaînements contigus, aucun
doublon nom + période. Les bornes `FromYear` / `ToYear` sont **inclusives des
deux côtés**.

Mesuré à travers le chemin exact de l'app, clé publishable comprise :

```
an 600     70 polités   0,19 Mo   1 requête    309 ms
an 1453   130 polités   0,39 Mo   2 requêtes   320 ms
1812      132 polités   0,57 Mo   2 requêtes   383 ms
2000      189 polités   0,88 Mo   2 requêtes   445 ms
```

---

## D'où viennent les données d'OpenHistoricalMap

[OpenHistoricalMap](https://www.openhistoricalmap.org) — un OpenStreetMap doté
d'une dimension temporelle. Chaque frontière y porte `start_date` / `end_date`,
et les vector tiles en exposent la forme décimale `start_decdate` /
`end_decdate` : 1804,25 pour le 1ᵉʳ avril 1804.

Licence : **CC0** (domaine public), d'après la réponse de leur Overpass et leur
wiki de réutilisation. L'attribution est une courtoisie, pas une obligation ;
elle est affichée quand même.

## Pourquoi on n'utilise pas leurs tuiles à l'exécution

C'était la première approche, et elle faisait planter l'app. Une tuile z4 sur
l'Europe, décodée :

```
entités              3 316          ← toute frontière ayant jamais existé là
géométrie          2 579 ko  (62 %)
index d'attributs    798 ko  (19 %)
dictionnaire noms    702 ko  (17 %)   ← ~600 champs name_xx par entité
total              4 192 ko
```

Une tuile ne contient pas « l'Europe » mais **l'Europe à toutes les époques à la
fois**. On en affiche une trentaine à une date donnée : 99 % des données sont
téléchargées et décodées pour être jetées. Assez pour qu'iOS évince l'app. Et
c'est structurel — plus on dézoome, plus la tuile couvre de territoire, donc
plus elle empile d'histoire.

D'où l'extraction hors ligne : on paie ce coût **une fois**, sur un poste de
travail, au lieu de le payer à chaque ouverture sur un téléphone.

---

## Le pipeline

### 1. Extraire

```bash
node scripts/extract-territories.mjs --world > monde.ndjson
```

Lit les tuiles z5 d'OHM, décode le MVT, garde les `admin_level` **2, 3 et 4** et
écrit du **NDJSON** — une entité par ligne.

Le niveau 2 est l'État souverain ; les niveaux 3 et 4 sont les fiefs, duchés,
principautés et villes libres qui vivent en dessous. Ne garder que le niveau 2
décrivait 1812 parfaitement et 1453 pas du tout : **OHM n'a aucun royaume de
France entre 1051 et 1659**, parce que la période a été cartographiée fief par
fief. Six siècles d'Europe étaient vides pour cette seule raison.

NDJSON et non un `FeatureCollection` unique : un balayage mondial fait 331 Mo,
que ni l'extracteur ni le chargeur ne doivent tenir en mémoire.

| option | défaut | rôle |
| --- | --- | --- |
| `--world` | — | planète entière, toutes époques |
| `--from`, `--to` | 1789, 1816 | fenêtre temporelle (années signées) |
| `--west/--south/--east/--north` | Europe | emprise en degrés |
| `--zoom` | 5 | zoom des tuiles lues |

Six téléchargements en parallèle, réessai exponentiel sur les 503 — leur serveur
limite le débit sur les rafales.

### 2. Charger

```bash
node scripts/load-territories.mjs monde.ndjson
```

Lit ligne par ligne et poste dans `territory_fragments` par lots bornés **en
octets** (1,5 Mo), trois requêtes en vol. Vide la table avant de commencer.

Lit `.env` pour les identifiants Supabase, et parle à PostgREST en `fetch` brut :
`supabase-js` tire un client realtime qui exige un WebSocket que Node 20 n'a pas.

### 3. Recoller

```bash
# dans le SQL Editor de Supabase, ou via psql
\i scripts/stitch-territories.sql
```

Les tuiles **découpent** la géométrie à leurs bords : un pays à cheval sur deux
tuiles arrive en morceaux, qui partagent leur `ohm_id`. `ST_Union` les réunit,
`ST_SimplifyPreserveTopology` à 0,01° (~1,1 km) les allège.

> **Cette requête dépasse le délai d'attente du client sur un balayage mondial,
> mais elle aboutit côté serveur.** Ne la relancez pas : vérifiez d'abord avec
> `select count(*) from public.territories`.

Le passage à trois niveaux a rendu la requête unique trop longue même pour la
patience du serveur. Le fichier reste écrit d'un bloc, mais pour un rechargement
mondial il vaut mieux l'exécuter **en trois passes**, une par `admin_level`, en
ajoutant `and f.admin_level = 2` (puis 3, puis 4) au `where` du CTE `parsed`.
Seule la passe du niveau 2 dépasse alors le délai du client.

### 4. Nettoyer

```sql
truncate table public.territory_fragments;
```

Les fragments ne servent plus une fois le recollage fait — ils pesaient 175 Mo
pour le monde. Les garder permet de refaire le lissage sans retélécharger les
tuiles ; les vider ramène la base à 82 Mo.

---

## Ce que l'app lit

Deux fonctions, et le chargement se fait **par entité, pas par date** :

```sql
territory_ids_at(annee, max_level)  -- identifiants seuls, 0,3 à 13 ko
territories_by_ids(ids[])           -- géométrie des entités manquantes
```

`max_level` vaut **2 par défaut** et **4** une fois la carte au zoom pays. Mais
le niveau seul serait un mauvais critère de visibilité, et c'est le point
important :

```sql
where ... and (t.admin_level <= max_level or t.standalone)
```

**`standalone`** dit qu'aucune entité souveraine ne recouvrait ce fief à son
époque. Le duché de Bar en 1453 n'a ni royaume de France ni Saint-Empire au
dessus de lui chez OHM : il est le rang politique le plus haut de son coin de
carte, et se cacher au zoom monde laisserait l'Europe blanche de la France à la
Russie. Un Land allemand en l'an 2000, lui, est recouvert par *Deutschland* : le
montrer au zoom monde ferait partir la planète en confettis. Le même test
sépare les deux, et le rapport s'inverse complètement avec l'époque :

| date | souverains | fiefs autonomes | fiefs recouverts |
| --- | --- | --- | --- |
| an 900 | 50 | 29 | 79 |
| 1200 | 70 | 73 | 83 |
| 1453 | 107 | **171** | 220 |
| 1600 | 106 | 170 | 195 |
| 1812 | 193 | 42 | 325 |
| 2000 | 217 | **20** | 757 |

Le drapeau est calculé une fois, en base : on teste `ST_PointOnSurface` du fief
contre les souverains vivants **au milieu de sa propre validité**. OHM redécoupe
une entité à chaque changement de tracé, donc une version dure peu et sa
couverture ne change pas en cours de route. Le test par point plutôt que par
aire d'intersection est mille fois moins cher et suffit à dire dedans ou dehors.

Les fiefs recouverts, eux, doublent le poids d'une date (1812 : 3,6 → 5,5 Mo) et
ne se dessinent qu'à partir du zoom pays : les demander avant serait payer pour
ce que personne ne voit. C'est `WorldMap` qui signale le franchissement, par
`onRegionDidChange`, et seulement au franchissement — pas à chaque geste.

**`area` et `anchor` sont des colonnes, pas des calculs.** Elles l'ont été :
`ST_Dump` puis `ST_PointOnSurface` sur chaque partie, à chaque appel, pour
560 entités à la fois. Assez cher pour dépasser le `statement_timeout` du rôle
`anon` et ne rien renvoyer du tout. Ce sont des valeurs fixes une fois la
géométrie posée.

**Et la demande est découpée.** Une date chargée faisait une réponse unique de
7 Mo, construite en une seule instruction — même sortie, le délai dépassé.
`fetchTerritoriesByIds` demande **120 entités par requête, trois en vol**. Plus
robuste et plus rapide :

```
2000, zoom pays   994 entités   7,51 Mo   9 requêtes   2 160 ms
1812, zoom pays   560 entités   5,50 Mo   5 requêtes   1 604 ms
1453, zoom monde  278 entités   1,29 Mo   3 requêtes     688 ms
```

Changer de date demande d'abord la liste d'identifiants, en déduit ce qui manque
au cache, et ne télécharge que ça. Une frontière ne changeant plus une fois
extraite, un polygone traverse le réseau **une fois par session** :

```
1214, 1er affichage   1 010 o d'identifiants + 110 620 o de géométrie
1215                  1 010 o                 + 0  (les 43 sont déjà là)
1250                  1 010 o                 + les 15 nouvelles seulement
```

Le cache vit dans `useTerritoriesAt.ts`, plafonné à 1 200 entités — au-dessus de
la date la plus chargée (994 en l'an 2000, fiefs compris), donc ce qui est à
l'écran ne peut jamais être évincé. Passer du zoom monde au zoom pays et revenir
ne coûte que la liste d'identifiants : la géométrie reste en cache.

---

## État actuel

Le monde entier, toutes époques :

```
1 024 tuiles z5  →  42 956 fragments  →  8 765 entités  →  58 Mo
```

| niveau | entités | sommets |
| --- | --- | --- |
| 2 — souverains | 3 928 | 4 007 843 |
| 3 — fiefs | 504 | 389 097 |
| 4 — fiefs | 4 333 | 1 076 593 |

Les fiefs ajoutent 55 % d'entités mais seulement 37 % de sommets : ils sont
petits. Le niveau 2 seul donnait 3 923 entités, recoupé par un recensement
indépendant mené en z3 : 3 910. Les deux méthodes tombaient d'accord à treize
près.

```
              entités   identifiants   géométrie (1er affichage)
                 entités au zoom monde   géométrie   au zoom pays
an 900                        79            0,45 Mo     158 / 0,61 Mo
an 1453                      278            1,29 Mo     498 / 1,79 Mo
1812                         235            3,57 Mo     560 / 5,50 Mo
2000                         237            3,00 Mo     994 / 7,51 Mo
```

Le zoom monde n'est pas « les souverains » : c'est « le rang le plus haut de
chaque région ». D'où 278 entités en 1453 pour 107 souverains.

Base totale : **82 Mo**, dont 58 de territoires et 7 de `spatial_ref_sys` (le
catalogue de systèmes de coordonnées installé par PostGIS, qu'on ne peut ni
réduire ni supprimer). Largement dans les 500 Mo du plan gratuit.

---

## Les noms

`territories.name` porte le nom **d'époque**, dans sa langue : *Francia
occidentalis*, *Rouantelezh Breizh*, *Ēastengla rīċe*, الْخِلَافَة الْعَبَّاسِيَّة. C'est
le seul nommage politique de la carte — `label-country` et `label-region` ont
été retirés du style, ils auraient affiché ceux d'aujourd'hui.

**Une étiquette par entité, pas par polygone.** MapLibre pose un nom sur
*chaque partie* d'un MultiPolygone : l'Empire byzantin en compte 58, le califat
abbasside 63, et à l'an 900 les 50 entités totalisent 234 parties — donc 234
noms à l'écran. `territories_by_ids` expose donc une `anchor`, calculée par
`ST_PointOnSurface` sur la **plus grande** partie, et la couche de texte est
alimentée par une source de points distincte des polygones.

`ST_PointOnSurface` et non `ST_Centroid` : le centroïde d'un territoire en
croissant peut tomber hors de ses terres. La plus grande partie, pour que le nom
se pose sur le continent et non sur une île perdue.

La taille du texte suit l'aire du polygone, exposée par `territories_by_ids`
via `ST_Area`. Vérifié : MapTiler sert les glyphes non latins pour la pile
« Noto Sans Bold » — 135 ko pour l'arabe, 147 ko pour l'éthiopien, autant pour
le cyrillique et le grec. Son serveur assure le repli sur la famille Noto.

Les tuiles d'OHM portent aussi des centaines de `name_xx` (traductions et
translittérations) que l'extraction ne conserve pas. Si vous vouliez un jour
proposer les noms en français, c'est là qu'il faudrait aller les chercher — au
prix d'une ré-extraction.

## Réglages

**Le lissage** — `0.01` dans `stitch-territories.sql`. Monter à `0.02` divise par
deux le poids d'une date moderne, au prix de côtes anguleuses au zoom régional.
Le pire cas actuel est ~1 Mo pour une date contemporaine, une fois par session.

**Le plafond du cache** — `CACHE_LIMIT` dans `useTerritoriesAt.ts`. À garder au
moins au double de la date la plus chargée.

**Les lavis** — `palette.washes`, huit teintes délavées. La couleur d'une entité
est tirée d'un hachage de son nom, donc stable d'une époque à l'autre.

---

## Les agglomérations

Même principe, autre couche : `place_points_centroids` du tileset `ohm`, et
**z6** au lieu de z5 — le tileur ne met aucune agglomération dans un carreau
en dessous de ce zoom, un carreau à l'échelle du monde qui contiendrait tous
les bourgs de l'histoire étant inutilisable. C'est toute la différence de coût
entre les deux jeux : chaque niveau de zoom quadruple le nombre de carreaux.

```
z5 =  1 024 carreaux   ← les frontières
z6 =  4 096 carreaux   ← les agglomérations
```

Le pipeline est plus court : **pas de table de transit ni de recollage**. Un
point n'est jamais découpé par le bord d'un carreau, la déduplication par
`ohm_id` se fait à l'extraction.

```bash
node scripts/extract-places.mjs --world > places.json
node scripts/load-places.mjs places.json
```

Résultat : 4 096 carreaux, 3,1 Mo de sortie, **23 279 lieux** — 6 098 villes et
17 181 bourgs, datés à 96-98 %. Aucun village : le tileur n'en met pas à z6.

```
             lieux   gzippé
an 900       1 668    32 ko
1453         4 864    88 ko
2020        16 416   296 ko
```

`places_at(année, types)` les rend en GeoJSON. Le cache est par date et non par
entité — un instantané de points est assez léger pour ça, contrairement aux
polygones des territoires.

L'affichage est étagé par zoom dans `PlaceLayers.tsx` : villes à partir de z3,
bourgs à partir de z5,5. Sans quoi la planche est un champ de points bien avant
que les noms ne deviennent lisibles.

## Limites connues

**Les villes sont plus rares que sur une carte moderne.** OHM en référence
23 279 dans toute l'histoire, contre des centaines de milliers pour MapTiler
aujourd'hui. La planche est plus dépouillée — ce qui n'est pas forcément un
défaut sur un atlas ancien, mais c'est un choix assumé.

**La couverture d'OHM est inégale**, dans l'espace et dans le temps. L'Europe
concentre l'essentiel des entités alors qu'elle représente une petite fraction
des terres émergées ; ailleurs on a les grands empires, pas les duchés. Et le
Moyen Âge tardif n'est cartographié qu'au niveau des fiefs : en 1453 il n'existe
ni royaume de France, ni Saint-Empire, ni Pologne-Lituanie, ni Hongrie au niveau
2. Mesuré sur l'Europe, la surface couverte par une entité quelconque vaut 33 %
de la surface d'aujourd'hui en 1450, 85 % en 1700. **Un vide sur la planche est
plus souvent un vide chez OHM qu'une erreur chez nous** — mais vérifiez les deux,
le filtre `admin_level` a longtemps été le coupable.

**C'est une photographie figée.** Les données ont été extraites une fois ; si les
contributeurs d'OHM corrigent un tracé, il faut relancer le pipeline. C'est le
prix de l'indépendance vis-à-vis de leur serveur — plus de 503, plus de 4 Mo par
tuile, et ça marche au dézoom.

**Les frontières nettes sont un anachronisme** pour une bonne part de l'histoire.
Le Saint-Empire en 1200 n'avait pas de frontière au sens moderne mais des
suzerainetés emboîtées. Tous les atlas historiques font ce choix ; il vaut la
peine de le savoir.
