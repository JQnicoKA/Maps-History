# Les territoires historiques

Comment les frontières arrivent sur la carte, et comment étendre ou refaire la
couverture. Trois scripts, une table, une heure de patience.

---

## D'où viennent les données

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

Lit les tuiles z5 d'OHM, décode le MVT, ne garde que `admin_level = 2` (les
entités souveraines : empires, royaumes, États) et écrit du **NDJSON** — une
entité par ligne.

NDJSON et non un `FeatureCollection` unique : un balayage mondial fait 228 Mo,
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

### 4. Nettoyer

```sql
truncate table public.territory_fragments;
```

Les fragments ne servent plus une fois le recollage fait — ils pesaient 128 Mo
pour le monde. Les garder permet de refaire le lissage sans retélécharger les
tuiles ; les vider ramène la base à 70 Mo.

---

## Ce que l'app lit

Deux fonctions, et le chargement se fait **par entité, pas par date** :

```sql
territory_ids_at(annee)     -- identifiants seuls, 0,3 à 5 ko
territories_by_ids(ids[])   -- géométrie des seules entités manquantes
```

Changer de date demande d'abord la liste d'identifiants, en déduit ce qui manque
au cache, et ne télécharge que ça. Une frontière ne changeant plus une fois
extraite, un polygone traverse le réseau **une fois par session** :

```
1214, 1er affichage   1 010 o d'identifiants + 110 620 o de géométrie
1215                  1 010 o                 + 0  (les 43 sont déjà là)
1250                  1 010 o                 + les 15 nouvelles seulement
```

Le cache vit dans `useTerritoriesAt.ts`, plafonné à 800 entités — bien au-dessus
de la date la plus chargée (218 en 2020), donc ce qui est à l'écran ne peut
jamais être évincé.

---

## État actuel

Le monde entier, toutes époques :

```
1 024 tuiles z5  →  29 796 fragments  →  3 923 entités  →  51 Mo
```

Recoupé par un recensement indépendant mené en z3 : 3 910 entités. Les deux
méthodes tombent d'accord à treize près.

```
              entités   identifiants   géométrie (1er affichage)
av. J.-C. 500      12        327 o
an 600             36        849 o
an 1453           107      2 481 o          270 ko
2020              218      4 949 o          959 ko
```

Base totale : **70 Mo**, dont 51 de territoires et 7 de `spatial_ref_sys` (le
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

## Limites connues

**La couverture d'OHM est inégale.** L'Europe compte 1 407 entités à elle seule
sur les 3 923 mondiales, alors qu'elle représente une petite fraction des terres
émergées. Ailleurs on a les grands empires, pas les duchés.

**C'est une photographie figée.** Les données ont été extraites une fois ; si les
contributeurs d'OHM corrigent un tracé, il faut relancer le pipeline. C'est le
prix de l'indépendance vis-à-vis de leur serveur — plus de 503, plus de 4 Mo par
tuile, et ça marche au dézoom.

**Les frontières nettes sont un anachronisme** pour une bonne part de l'histoire.
Le Saint-Empire en 1200 n'avait pas de frontière au sens moderne mais des
suzerainetés emboîtées. Tous les atlas historiques font ce choix ; il vaut la
peine de le savoir.
