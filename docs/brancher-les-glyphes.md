# Héberger nos propres glyphes

## Pourquoi, et ce n'est pas l'argent

MapTiler sert les polices **gratuitement** : leur grille tarifaire range les
fonts avec les TileJSON et les Style JSON dans ce qui n'est pas facturé. Il n'y
a donc rien à économiser.

Ce qu'il y a à gagner est la **disponibilité**. Les glyphes passent par la même
clé que le relief, qui lui est facturé. Or MapTiler permet — et il faut — de
poser un plafond de dépense, et quand ce plafond est atteint il **invalide
toutes les clés du compte** jusqu'à la fin du mois.

Donc aujourd'hui, le jour où l'ombrage ferait exploser le plafond, la carte
perdrait **tout son texte** en même temps : noms de pays, villes, territoires.
Une ressource gratuite tuée par une ressource payante, par le seul fait qu'elles
partagent une clé.

Et un bénéfice en prime : MapTiler ne sert **aucune police à empattements**.
C'est écrit dans `typography.ts` — *« no serif is available »* — et c'est
pourquoi l'allure d'atlas ancien vient de l'espacement et des petites capitales
plutôt que du dessin des lettres. Avec nos propres glyphes, le choix redevient
libre.

---

## Ce qu'un glyphe est, pour qui lirait cette note sans contexte

MapLibre dessine sur le GPU et **n'a pas accès aux polices du système**. Pour
tracer un `R` il lui faut l'image du `R` : un contour converti en empreinte de
distance signée, livré par tranches de 256 points de code dans des fichiers
`.pbf`.

Les **noms** viennent d'ailleurs — de Supabase pour les territoires et les
villes, des tuiles pour les continents. Les glyphes sont l'**alphabet qui les
écrit**. Sans eux, la carte est muette avec ses données intactes.

---

## 1. Fabriquer

```sh
npm run glyphs
```

Lit `assets/fonts/src/*.ttf`, écrit `build/glyphs/`. Aujourd'hui : **104
fichiers, 4,7 Mo**, quatre dossiers de 26 tranches.

```
build/glyphs/
├── Metropolis Semi Bold,Noto Sans Bold/   0-255.pbf … 11264-11519.pbf
├── Noto Sans Bold,Noto Sans Regular/
├── Noto Sans Italic,Noto Sans Regular/
└── Noto Sans Regular/
```

### Pourquoi un dossier par **pile** et non par police

MapLibre demande la pile entière dans un seul segment d'URL, les noms joints
par des virgules :

```
…/Noto%20Sans%20Bold,Noto%20Sans%20Regular/0-255.pbf
```

Un serveur de fichiers ne sait pas composer à la volée. Chaque combinaison
employée par le style doit donc exister comme dossier, pré-composée — la
première police qui possède un caractère l'emporte, les suivantes bouchent ses
trous. C'est ce que fait `@mapbox/glyph-pbf-composite`, et c'est pourquoi les
accents français de la pile Metropolis viennent en réalité de Noto Sans Bold :
Metropolis ne couvre que 306 caractères.

Les piles vivent dans `scripts/glyph-stacks.mjs`, et `glyphStacks.test.ts`
**refuse qu'elles divergent** de `typography.ts`. Sans ce garde-fou, ajouter une
pile sans la déclarer ne casserait rien à la compilation : la carte perdrait
tout le texte de ce calque, en silence, au déploiement.

Seules les tranches qui contiennent quelque chose sont écrites. Une tranche
absente répond 404, ce que MapLibre encaisse sans rien perdre d'autre.

---

## 2. Téléverser

Dans le **même seau R2 que l'archive PMTiles** — il est déjà public, c'est
ainsi que l'archive se lit — mais **pas à sa racine**, et sous un préfixe
**daté**.

```
<seau>/
├── planet-z10-2026-10.pmtiles      ← l'archive, 2 Go
└── glyphs/2026-10/
    ├── Metropolis Semi Bold,Noto Sans Bold/0-255.pbf …
    ├── Noto Sans Bold,Noto Sans Regular/…
    ├── Noto Sans Italic,Noto Sans Regular/…
    └── Noto Sans Regular/…
```

### Pourquoi daté, et ce n'est pas de la coquetterie

Les tuiles sont servies avec `Cache-Control: immutable, max-age=31536000` — un
an. C'est tenable parce que l'archive porte sa date **dans son nom** :
`planet-z10-2026-10.pmtiles`. Un chemin de glyphe, lui, n'a pas de version
naturelle : `Noto Sans Regular/0-255.pbf` est le même nom aujourd'hui et après
un changement de police.

Sans le préfixe daté, changer de police un jour laisserait les anciennes lettres
dans les caches pendant un an, chez chaque lecteur, sans aucun moyen de les en
chasser. Avec, il suffit d'écrire le nouveau préfixe dans `.env`.

### L'envoi

`rclone`, comme pour les tuiles — mêmes variables, même discipline de lignes
courtes qui survivent au collage. Il n'est pas installé sur le poste de
développement : `brew install rclone`.

```sh
cd <le dépôt>

export R2_ACCOUNT=…               # l'identifiant de compte Cloudflare
export R2_KEY=…                   # l'Access Key ID du jeton
read -rs R2_SECRET                # saisi sans écho, pas dans l'historique
export R2_SECRET

export RCLONE_S3_PROVIDER=Cloudflare
export RCLONE_S3_ENDPOINT=https://$R2_ACCOUNT.r2.cloudflarestorage.com
export RCLONE_S3_ACCESS_KEY_ID=$R2_KEY
export RCLONE_S3_SECRET_ACCESS_KEY=$R2_SECRET
export RCLONE_S3_NO_CHECK_BUCKET=true
export RCLONE_HEADER_UPLOAD="Cache-Control: public, max-age=31536000, immutable"

B=:s3:<NOM-DU-BUCKET>/glyphs/2026-10
echo $B                           # relire avant de lancer
rclone copy build/glyphs "$B" -P
```

`copy` et non `copyto` : ici on verse le **contenu** d'un dossier, pas un
fichier vers un fichier. Et si R2 répond `NoSuchBucket`, les deux causes sont
celles de `construire-les-tuiles.md` — la juridiction du seau avant son nom.

> **Les noms de dossiers contiennent des espaces et des virgules.** C'est
> MapLibre qui l'impose, pas nous. Les clés R2 les acceptent et le décodage de
> l'URL rend le nom exact — mais un 404 ici ne se voit qu'en texte manquant,
> alors vérifiez avant de recompiler.

Pas de CORS à configurer : MapLibre Native n'est pas un navigateur. La question
ne se poserait que pour une version web.

### Vérifier avant de recompiler

```sh
BASE="https://pub-fd69708b34254e3cabc8112d91c58b0a.r2.dev/glyphs/2026-10"
curl -sS -o /dev/null -w "%{http_code} %{size_download} octets\n" \
  "$BASE/Noto%20Sans%20Bold,Noto%20Sans%20Regular/0-255.pbf"
```

Attendu : `200` et quelques dizaines de milliers d'octets. Un `403` ou un `404`
ici, et la carte sera muette.


## 3. Brancher

```sh
# .env — sans barre oblique finale, et avec le préfixe daté
EXPO_PUBLIC_GLYPHS_URL=https://pub-fd69708b34254e3cabc8112d91c58b0a.r2.dev/glyphs/2026-10
```

Puis recompiler : `EXPO_PUBLIC_*` est inliné dans le bundle **au moment de la
compilation**. Une build antérieure continuera de lire MapTiler, pour toujours.

Vidée, la variable renvoie à MapTiler sans rien recompiler d'autre que le
bundle — c'est le même interrupteur que `EXPO_PUBLIC_TILES_URL`, et les deux
sont indépendants.

---

## 4. Ce qui change dans l'avertissement de configuration

`MapScreen` ne réclame plus `EXPO_PUBLIC_MAPTILER_API_KEY` inconditionnellement.
La clé ne sert plus qu'à deux choses, chacune avec son interrupteur :

| Ce qui la réclame | Comment s'en passer |
|---|---|
| Le fond de carte | `EXPO_PUBLIC_TILES_URL` renseignée |
| L'ombrage du relief | `MAP_FEATURES.relief = false` |

Les lettres n'y figurent plus. Une installation qui héberge son fond, ses
lettres et renonce à l'ombrage n'a donc **plus besoin de clé du tout** — et
plus aucune requête facturée.

---

## 5. Changer de police

Voir `assets/fonts/src/README.md` : déposer les `.ttf` et leur licence,
corriger `typography.ts`, reporter les piles dans `glyph-stacks.mjs`,
`npm run glyphs`, téléverser.

Les `.pbf` **sont des dérivés** de la police : l'OFL demande que la licence les
accompagne. Les deux textes sont dans `assets/fonts/src/`.
