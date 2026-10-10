# Construire les tuiles sur un serveur loué et les publier sur R2

Marche à suivre linéaire, de la location de la machine jusqu'à une adresse
HTTPS qui répond. Rien ici ne suppose de connaître un projet particulier.

**Le livrable** : un fichier `.pmtiles` unique, fond de carte vectoriel
mondial, zooms 0 à 10, réduit à cinq calques, servi depuis Cloudflare R2.

**Les cinq calques**, à recopier tels quels partout où ils apparaissent :

```
water,waterway,landcover,water_name,mountain_peak
```

Un fond de carte d'atlas ne dessine que l'eau, le couvert végétal et les
sommets. Mesuré sur de vraies tuiles, les douze autres calques du jeu complet
représentent jusqu'à 99 % du poids téléchargé pour rien.

> **La chaîne entière a été parcourue le 10 octobre 2026**, de la location à
> une adresse HTTPS qui répond en `206`. Tous les chiffres de ce document sont
> mesurés, plus aucun n'est extrapolé. Le § 14 dit ce qui reste inconnu, et la
> liste a beaucoup maigri.
>
> Mesures de ce parcours : pbf planétaire **89 Go**, construction
> **13 min 34 s** sur une CCX63, archive **2 155 370 880 octets** pour
> **1 144 368 tuiles**, envoi sur R2 en **59 s**. Environ **3 heures** en tout,
> **~1,40 €**.

---

## 1. À préparer avant de louer

Le compteur tourne dès la création de la machine. Ces trois points se règlent
en amont, gratuitement.

**Le compte Hetzner.** La vérification d'identité peut prendre quelques heures
sur un compte neuf. À créer la veille.

**Le compte Cloudflare, avec R2 activé.** Créer déjà le bucket et le jeton
d'accès (étapes 8.1 et 8.2) : quand le fichier sera prêt, vous n'aurez plus
envie d'attendre.

**La décision sur le nom de domaine.** C'est le seul choix qui ait des
conséquences au-delà de ce chantier, et il vaut mieux l'avoir tranché avant.
Voir l'étape 9.

**Une clé SSH**, si vous n'en avez pas :

```sh
ssh-keygen -t ed25519 -C "tuiles"
cat ~/.ssh/id_ed25519.pub        # c'est ceci qu'on collera chez Hetzner
```

---

## 2. Louer la machine

### 2.1 Laquelle

Hetzner Cloud, facturation à l'heure, gamme **Dedicated vCPU (CCX)** :

| | vCPU | RAM | NVMe | à l'heure |
|---|---|---|---|---|
| CCX53 | 32 | 128 Go | 600 Go | 0,3085 € |
| **CCX63** | 48 | 188 Go | **960 Go** | **0,4623 €** |

**Prendre la CCX63.** Deux raisons chiffrées :

- **Le disque.** Planetiler demande 5 à 10 fois la taille de la source en
  espace de travail transitoire. Pour un pbf planétaire de ~80 Go, les 600 Go
  de la CCX53 ne laissent aucune marge — et découvrir qu'on est à court après
  deux heures de calcul, c'est tout recommencer.
- **La RAM.** Avec `--nodemap-storage=ram`, la JVM veut au moins 1,5 fois la
  taille de la source, soit ~120 Go. La CCX53 n'en a que 128, il resterait
  8 Go pour tout le reste. Les 188 Go de la CCX63 tombent juste.

Compter **3 à 5 heures** en tout, téléchargement compris : de l'ordre de **2 à
3 €**.

### 2.2 La créer

Sur **console.hetzner.cloud** → *New project* → *Add Server* :

| champ | valeur |
|---|---|
| Location | Falkenstein ou Helsinki (les moins chers, dans l'EEE) |
| Image | Ubuntu 24.04 |
| Type | onglet **Dedicated vCPU** → `CCX63` |
| SSH key | votre clé publique — pas de mot de passe, la machine est sur Internet ouvert |
| Name | `tuiles`, pour la reconnaître au moment de la détruire |

*Create & Buy now*, puis noter l'adresse IP et se connecter :

```sh
ssh root@<IP>
```

---

## 3. Préparer le serveur

```sh
apt-get update && apt-get install -y docker.io tmux rclone
systemctl enable --now docker
docker --version

# Le client pmtiles, pour vérifier et mesurer
cd /tmp
curl -s https://api.github.com/repos/protomaps/go-pmtiles/releases/latest > r.json
grep -o 'https://[^"]*Linux_x86_64.tar.gz' r.json | head -1
# puis, avec l'adresse affichée (1.31.2 au 10 octobre 2026) :
curl -sLO https://github.com/protomaps/go-pmtiles/releases/download/v1.31.2/go-pmtiles_1.31.2_Linux_x86_64.tar.gz
tar xzf go-pmtiles_1.31.2_Linux_x86_64.tar.gz
mv pmtiles /usr/local/bin/
pmtiles version

# Doit afficher ~900 Go libres
df -h /
```

### ⚠️ Des commandes courtes, et un `echo` avant de lancer

**Vécu, et c'est l'ennui qui a coûté le plus de temps du parcours** : au-delà
d'une centaine de caractères, un collage dans un terminal SSH **perd des
caractères en silence**. Observé deux fois — un `-v /chemin/data:/data` devenu
`:/dat`, une espace avalée entre deux drapeaux. Le shell exécute alors une
commande qui n'est pas celle qu'on croit, et sur une construction de plusieurs
heures la faute ne se voit qu'à la fin.

Deux habitudes suffisent :

- **ranger les morceaux dans des variables**, de sorte qu'aucune ligne collée
  ne dépasse ~50 caractères ;
- **relire la commande assemblée avec `echo` avant de la lancer**, et la
  comparer caractère par caractère.

Les barres obliques de continuation de ligne sont le pire cas : elles ne
survivent presque jamais au collage. Tout ce document les utilise pour la
lisibilité ; **sur le terminal, aplatissez-les.**

### ⚠️ Tout le long travail dans `tmux`

Une construction planétaire dure des heures. Si la session SSH tombe — veille
du portable, coupure Wi-Fi — **le travail meurt avec elle**. C'est l'erreur qui
coûte le plus cher ici.

```sh
tmux new -s tuiles
# … lancer les commandes longues là-dedans …
# se détacher :  Ctrl-b  puis  d
# revenir :      ssh root@<IP>  puis  tmux attach -t tuiles
```

---

## 4. Essai à blanc sur Monaco

**Ne pas sauter.** Deux minutes, et il fait deux choses : il valide la chaîne
sur cette machine neuve, et il **télécharge au passage les trois sources de
taille fixe** dont la planète aura besoin.

```sh
mkdir -p ~/tuiles/data && cd ~/tuiles

docker run --rm -v "$(pwd)/data":/data \
  openmaptiles/planetiler-openmaptiles:latest \
  --only-download --download \
  --area=monaco \
  --http-timeout=120s --http-retries=5 \
  --output=/data/monaco-z10.pmtiles
```

⚠️ **`--http-timeout` exige une unité** : `120s`, pas `120`. Sans unité l'outil
s'arrête sur `DateTimeParseException`. Et le défaut de 30 s **ne suffit pas** :
vérifié, la demande de taille du fichier OSM part en `TimeoutException`
pendant que les autres sources saturent la liaison.

Ce qui arrive, mesuré :

| source | poids | varie avec la zone ? |
|---|---|---|
| `water_polygons` | 888 Mo | non |
| `natural_earth` | 413 Mo | non |
| `lake_centerlines` | 77 Mo | non |
| l'extrait OSM | 675 Ko pour Monaco | oui |

Soit **~1,4 Go incompressible**, conservé dans `data/sources/` et jamais
retéléchargé. Puis le calcul :

```sh
docker run --rm -v "$(pwd)/data":/data \
  openmaptiles/planetiler-openmaptiles:latest \
  --force \
  --area=monaco \
  --minzoom=0 --maxzoom=10 \
  --only-layers=water,waterway,landcover,water_name,mountain_peak \
  --output=/data/monaco-z10.pmtiles

pmtiles verify data/monaco-z10.pmtiles
pmtiles show   data/monaco-z10.pmtiles
```

**Attendu, mesuré** : ~46 Ko, spec version 3, type `mvt`, **min zoom 0, max
zoom 10**, 13 tuiles, attribution déjà inscrite dans l'archive.

**Les calques seront `water`, `waterway` et `mountain_peak` seulement.** Ce
n'est pas un échec du filtre : Monaco fait deux kilomètres carrés, sans couvert
végétal de taille suffisante ni plan d'eau nommé dont l'étiquette tombe dans la
zone. Vérifié en reconstruisant le même Monaco **sans aucun filtre** : les deux
autres manquent pareillement.

Pour lister les calques d'une archive :

```sh
pmtiles show --metadata data/monaco-z10.pmtiles | python3 -c \
  "import json,sys; print(sorted(l['id'] for l in json.load(sys.stdin)['vector_layers']))"
```

Si un drapeau est refusé, la liste complète est là :

```sh
docker run --rm openmaptiles/planetiler-openmaptiles:latest --help | less
```

---

## 5. Récupérer le pbf planétaire

**Avec `curl`, pas avec `--download`.** Le téléchargeur interne de Planetiler a
échoué deux fois sur deux à l'essai, même avec le délai allongé. Et pour 80 Go,
la reprise après coupure n'est pas un luxe.

```sh
cd ~/tuiles/data/sources

curl -L -C - --retry 5 --retry-delay 10 \
  -o planet.osm.pbf \
  https://planet.openstreetmap.org/pbf/planet-latest.osm.pbf

ls -lh planet.osm.pbf
```

`-C -` reprend là où le transfert s'était arrêté : si ça coupe, relancer la
même commande.

**Mesuré le 10 octobre 2026** : **88,7 Go** annoncés, 89 Go sur le disque,
**20 minutes** à ~42 Mo/s depuis Helsinki. Les données OSM du fichier datent
de cinq jours avant le téléchargement.

⚠️ **La source grossit avec le temps**, et le `-Xmx` de l'étape 6 en dépend :
la règle est « au moins 1,5 × la source », soit 133 Go pour 88,7. Les 140 Go
prescrits tiennent encore, mais la marge se réduit d'année en année — vérifiez
ce rapport avant de lancer, et augmentez `-Xmx` si la source a dépassé 125 Go.

Des miroirs plus rapides selon la géographie sont listés sur
`wiki.openstreetmap.org/wiki/Planet.osm` — à essayer si le débit déçoit.

### Variante : l'Europe d'abord

Si vous préférez une répétition grandeur réelle avant d'engager la planète :

```sh
curl -L -C - --retry 5 -o europe.osm.pbf \
  https://download.geofabrik.de/europe-latest.osm.pbf
```

~28 Go. **Règle de décision** : si l'Europe passe en moins d'une heure, la
planète passera dans la journée. Sinon, revoir le dimensionnement avant de
lancer 80 Go.

---

## 6. Construire

```sh
cd ~/tuiles

docker run --rm -v "$(pwd)/data":/data \
  -e JAVA_TOOL_OPTIONS=-Xmx140g \
  openmaptiles/planetiler-openmaptiles:latest \
  --force \
  --osm-path=/data/sources/planet.osm.pbf \
  --bounds=world \
  --minzoom=0 --maxzoom=10 \
  --only-layers=water,waterway,landcover,water_name,mountain_peak \
  --nodemap-type=sparsearray --nodemap-storage=ram \
  --output=/data/planet-z10-2026-10.pmtiles
```

Pas de `--download` : les trois sources fixes sont déjà dans `data/sources/`
depuis l'étape 4, et Planetiler les y trouve seul. Vérifié.

Les réglages, un par un :

- **`--osm-path`** au lieu de `--area` : on pointe le fichier déjà récupéré.
- **`-Xmx140g`** : la JVM veut ≥ 1,5 × la taille de la source (120 Go pour
  80 Go de pbf) ; 140 laisse de la marge sans étouffer le système.
- **`--nodemap-storage=ram`** n'a de sens que pour la planète. Pour une région,
  **retirer les deux drapeaux `nodemap`** et le `-Xmx` : le défaut travaille
  sur disque et suffit.
- **`--maxzoom=10`.** Au-delà, le lecteur étire la tuile z10 au lieu d'en
  demander une plus fine. Sur des côtes et des aplats, ça ne se voit pas.
  **`--maxzoom=9` divise le poids par quatre** : c'est le premier levier si le
  fichier est trop gros.
- **Le nom porte sa date.** Le fichier sera servi avec un an de cache, donc on
  ne remplace jamais un fichier en place : on en publie un neuf et on change
  l'adresse.

Si le travail est interrompu, relancer la même commande : les sources sont
conservées, seul le calcul reprend de zéro.

### Mesuré, et une correction

**13 minutes 34 secondes** sur une CCX63 (48 vCPU, 188 Go, Helsinki), pour
89 Go de source. C'est bien plus rapide que je ne l'annonçais.

Et **ma règle des « 5 à 10 fois la taille de la source » en espace de travail
était fausse dans cette configuration** : le fichier transitoire de
caractéristiques n'a pesé que **6,1 Go**, là où cette règle laissait craindre
440 à 890 Go. Deux raisons : `--nodemap-storage=ram` met en mémoire la plus
grosse structure, et **cinq calques jusqu'au zoom 10 seulement** réduisent
énormément le nombre d'objets triés sur disque. La règle vaut pour une
construction complète à haut zoom, pas pour celle-ci.

**Conséquence sur le dimensionnement** : le disque n'est pas le facteur
limitant, la RAM l'est. Une CCX53 (128 Go) resterait trop juste pour le `-Xmx`,
mais ses 600 Go de disque auraient amplement suffi.

---

## 7. Mesurer

```sh
pmtiles verify data/planet-z10-2026-10.pmtiles
pmtiles show   data/planet-z10-2026-10.pmtiles
ls -lh         data/planet-z10-2026-10.pmtiles
```

`verify` doit se terminer sans erreur. **Trois chiffres à noter** — ce sont eux
qu'on rapporte : le **poids**, le **nombre de tuiles**, le **poids moyen par
tuile**.

### Vérifier les cinq calques

C'est **le** contrôle qui compte, celui qui dirait qu'un calque manque avant
que la carte ne le révèle :

```sh
pmtiles show --metadata data/planet-z10-2026-10.pmtiles | python3 -c "
import json,sys
vl=json.load(sys.stdin)['vector_layers']
voulus={'water','waterway','landcover','water_name','mountain_peak'}
noms={l['id'] for l in vl}
for l in sorted(vl, key=lambda x: x['id']):
    print(f\"  {l['id']:16} z{l.get('minzoom')}-{l.get('maxzoom')}\")
print('  manquants :', sorted(voulus-noms) or 'AUCUN')
print('  en trop   :', sorted(noms-voulus) or 'aucun')"
```

**Les cinq doivent être là.** Sur une archive mondiale, les plages attendues :

| calque | plage sur un jeu mondial |
|---|---|
| `water` | z0–10 |
| `landcover` | z2–10 (glaciers Natural Earth en bas, OSM à partir de z7) |
| `waterway` | z3–10 |
| `water_name` | **z0–10** — océans et mers dès z0 |
| `mountain_peak` | z7–10 |

> Sur un extrait régional ces planchers remontent, et c'est normal : la Suisse
> donnait `water_name` à z7 parce qu'un pays sans littoral n'a ni océan ni mer.
> Sur la planète, `water_name` **doit** descendre à z0 — sinon les noms
> d'océans manqueront au planisphère.

### Regarder avant de téléverser

```sh
pmtiles serve data/planet-z10-2026-10.pmtiles --port 8080
# puis, depuis votre machine :  ssh -L 8080:localhost:8080 root@<IP>
# et ouvrir http://localhost:8080
```

### Repères mesurés

| | pbf source | archive z0–10 | tuiles adressées | calcul |
|---|---|---|---|---|
| Monaco | 675 Ko | 46 Ko | 13 | 34 s |
| Suisse | 522 Mo | 5,2 Mo | 171 | — |
| **Planète** | **89 Go** | **2 155 370 880 o** | **1 144 368** | **13 min 34 s** |

Les deux extrapolations que portait ce document — 0,8 Go au prorata du pbf,
18 Go au prorata des terres émergées — encadraient correctement la réalité
sans l'approcher. **La mesure est 2,1 Go**, donc plus près de la borne basse.

Ce qui explique ce chiffre : sur 1 144 368 tuiles adressées, seules **329 906
sont réellement distinctes**. **71 % sont des doublons** déduplyqués par le
format, parce que toutes les tuiles de plein océan sont identiques entre elles.
D'où **~1,8 ko par tuile adressée** et ~6,4 ko par tuile distincte.

**Le stockage R2 est donc gratuit** : 2,1 Go sous le seuil de 10 Go.

---

## 8. Envoyer sur R2, depuis le serveur

**Depuis le serveur, jamais en rapatriant le fichier chez vous.** La machine a
une liaison à plusieurs gigabits ; votre connexion domestique mettrait des
heures à descendre 20 Go pour les remonter ensuite.

### 8.1 Le bucket

Tableau de bord Cloudflare → **R2** → *Create bucket*.

**Deux choix à noter, parce qu'ils sont tous deux source d'un `NoSuchBucket`
trompeur à l'étape 8.3 :**

- **Le nom exact.** La suite l'emploie littéralement. Copiez-le depuis
  l'interface au moment de l'envoi plutôt que de le retaper.
- **La juridiction.** Si vous choisissez l'**Union européenne** — recommandé
  dès que votre politique de confidentialité promet de ne pas transférer hors
  de l'EEE — alors **l'adresse du point d'accès S3 n'est pas la même**, et
  c'est l'erreur qui a fait échouer trois envois lors du parcours. Voir 8.3.

Pour mémoire : 10 Go de stockage et 10 millions de lectures gratuits par mois,
puis 0,015 $/Go et 0,36 $ le million. **L'egress est gratuit sans plafond** —
c'est la seule raison de choisir R2 plutôt qu'un autre stockage objet.

### 8.2 Le jeton

R2 → **Manage API Tokens** → créer un jeton avec droit d'**écriture** sur ce
bucket. Noter l'**Access Key ID**, la **Secret Access Key** et l'**Account ID**.

### 8.3 L'envoi

L'interface web ne convient pas à un fichier de plusieurs gigaoctets. Avec
`rclone`, déjà installé à l'étape 3.

**Par variables d'environnement plutôt que par options de ligne de commande**,
et ce n'est pas un détail de style : la forme à options tient sur dix lignes
prolongées par des barres obliques, qui ne survivent pas au collage — voir
l'avertissement de l'étape 3. Ici, aucune ligne ne dépasse 50 caractères.

```sh
cd ~/tuiles

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

F=data/planet-z10-2026-10.pmtiles
B=:s3:<NOM-DU-BUCKET>/planet-z10-2026-10.pmtiles
echo $B                           # relire avant de lancer
rclone copyto $F $B -P
```

### ⚠️ Si R2 répond `NoSuchBucket`

Les deux causes, dans l'ordre où il faut les écarter :

**1. La juridiction.** Un bucket créé en juridiction **Union européenne** ne
répond **pas** sur `https://<compte>.r2.cloudflarestorage.com` mais sur :

```sh
export RCLONE_S3_ENDPOINT=https://$R2_ACCOUNT.eu.r2.cloudflarestorage.com
```

C'était la cause lors du parcours du 10 octobre 2026, et le message
`NoSuchBucket` ne l'indique en rien. L'adresse S3 exacte du bucket est
affichée par Cloudflare dans *Settings* → **S3 API** : c'est la vérité de
terrain, lisez-la là plutôt que de la déduire.

**2. Le nom.** Un tiret, un pluriel ou une majuscule produisent le même
message. Copiez le nom depuis l'interface.

> **Diagnostic utile** : `rclone lsd :s3:` qui répond `403 AccessDenied` est
> une **bonne** nouvelle — identifiants et adresse valides, mais jeton limité à
> un seul bucket, ce qui est exactement ce qu'on veut d'un jeton. Un échec de
> connexion, lui, désignerait l'adresse ou les clés.

### Les trois détails qui comptent

- **`--s3-no-check-bucket`** (ici `RCLONE_S3_NO_CHECK_BUCKET`) évite un appel
  de création de bucket que R2 refuse.
- **L'en-tête de cache** : le fichier ne change jamais, et un an de cache évite
  de repayer la même lecture. **On ne peut pas le poser après coup sans
  réenvoyer** — donc le vérifier tout de suite (voir plus bas).
- **Un `501 NotImplemented` à la première tentative n'est pas un échec.** Lors
  du parcours, rclone a signalé `Attempt 1/3 failed … NotImplemented` puis
  `Attempt 2/3 succeeded`, et le fichier est arrivé complet avec son en-tête de
  cache. R2 n'implémente pas tout le protocole S3 d'envoi partitionné ; rclone
  se replie seul. **Ce qui fait foi, c'est la vérification ci-dessous.**

Mesuré : **2,1 Go en 59 secondes** à 34,7 Mio/s depuis Helsinki.

> **Si l'envoi échoue sur une erreur de somme de contrôle** avec le client AWS
> plutôt que rclone, c'est une incompatibilité connue entre ses versions
> récentes et R2 : ajouter `--checksum-algorithm CRC32`, ou poser
> `AWS_REQUEST_CHECKSUM_CALCULATION=when_required`. À n'appliquer qu'en cas
> d'échec, cela peut avoir été corrigé entre-temps.

Vérifier que l'objet est arrivé, à la bonne taille, **et avec son en-tête de
cache** — c'est ce dernier point qui justifie la seconde commande :

```sh
rclone ls :s3:<NOM-DU-BUCKET>
rclone lsjson --metadata :s3:<NOM-DU-BUCKET>
```

La seconde doit montrer, dans `Metadata` :

```
"cache-control":"public, max-age=31536000,  immutable"
```

La double espace avant `immutable` est cosmétique, HTTP l'ignore. **S'il est
absent**, réenvoyez : une minute contre un an de cache sur chaque lecture.

---

## 9. L'adresse publique

**L'adresse `r2.dev` fournie d'office est bridée et réservée au
développement.** Pour servir du vrai trafic il faut rattacher un domaine :
R2 → le bucket → *Settings* → *Public access* → *Connect domain*.

⚠️ **Et voici la seule décision de ce chantier qui déborde sur le reste.**
Rattacher un domaine à R2 suppose que la **zone DNS soit gérée par
Cloudflare**. Si le domaine est aujourd'hui ailleurs, cela veut dire déplacer
ses serveurs de noms — ce qui **emporte les enregistrements MX du courriel et
ceux du site web**, à recréer à l'identique chez Cloudflare sous peine de
couper les deux.

Trois sorties :

1. **Déplacer la zone chez Cloudflare** (gratuit). Relever d'abord *tous* les
   enregistrements existants — A, CNAME, **MX**, TXT — et les recréer avant de
   changer les serveurs de noms.
2. **Déléguer un sous-domaine seul** : ajouter `tiles.example.com` comme zone
   chez Cloudflare et poser les `NS` correspondants chez l'hébergeur actuel. Le
   reste du domaine n'est pas touché. *À vérifier dans l'interface du moment,
   la prise en charge des sous-domaines ayant évolué.*
3. **Prendre un autre domaine** pour les tuiles, ce qui évite la question.

---

## 10. Vérifier la seule inconnue technique

PMTiles lit **des tranches d'octets** dans un fichier unique. Tout dépend donc
du fait que le serveur honore l'en-tête `Range`. À tester **depuis votre
machine**, sur l'adresse finale :

```sh
curl -s -o /dev/null -D- -H "Range: bytes=0-16383" \
  "https://tiles.example.com/planet-z10-2026-10.pmtiles" \
  | grep -iE "^HTTP/|content-range|content-length|cache-control"
```

Attendu :

```
HTTP/2 206
content-range: bytes 0-16383/<taille totale>
content-length: 16384
cache-control: public, max-age=31536000, immutable
```

**Un `200` au lieu d'un `206` est un échec** : le serveur renverrait tout le
fichier à chaque tuile. Ne pas continuer sans `206`.

**Mesuré le 10 octobre 2026 : R2 répond `206`**, au début du fichier comme au
milieu, avec `Accept-Ranges: bytes` et l'en-tête de cache. Cette inconnue est
levée.

> **Faites ce test avant de détruire la machine, sur l'adresse `r2.dev`.**
> Cloudflare l'ouvre en un interrupteur — bucket → *Settings* → *Public
> access* → sous-domaine `r2.dev` — et elle suffit à valider toute la chaîne.
> Elle est bridée et réservée au développement, donc pas destinée au trafic
> réel, mais elle vous permet de **détruire le serveur tout de suite** et de
> régler la question du domaine (étape 9) à froid, des jours plus tard s'il le
> faut.

Puis la vérification de bout en bout, qui lit l'en-tête PMTiles à distance :

```sh
pmtiles show "https://tiles.example.com/planet-z10-2026-10.pmtiles"
```

Mêmes chiffres qu'en local : la chaîne est complète.

**Sans `pmtiles` sur votre machine**, les 127 premiers octets suffisent — c'est
l'en-tête du format, et le lire par une requête de plage prouve exactement ce
que fera le lecteur de cartes :

```sh
curl -s -H "Range: bytes=0-126" "<URL>" -o entete.bin
python3 -c "
import struct
d=open('entete.bin','rb').read()
print('signature :', d[:7].decode(), d[:7]==b'PMTiles')
print('spec      :', d[7])
a,e,c = struct.unpack('<QQQ', d[72:96])
print('adressées :', a, '| distinctes :', c)
print('zoom      :', d[100], '-', d[101])"
```

Lors du parcours, les chiffres lus à distance étaient **identiques** à ceux
mesurés sur le serveur : 1 144 368 tuiles adressées, 329 906 distinctes,
zoom 0–10.

---

## 11. Ce qu'on rapporte

- **L'adresse HTTPS** complète du fichier.
- Le **poids**, le **nombre de tuiles**, le **poids moyen par tuile**.
- Le **maxzoom** réellement construit, s'il a fallu descendre à 9.
- La **liste des cinq calques** avec leurs plages de zoom.
- La confirmation du **`206`** sur l'adresse finale.

### Le relevé du 10 octobre 2026

| | |
|---|---|
| fichier | `planet-z10-2026-10.pmtiles` |
| poids | 2 155 370 880 octets (2,007 Gio) |
| tuiles adressées | 1 144 368 |
| tuiles distinctes | 329 906 — **71 % de doublons** |
| poids moyen | ~1,8 ko par tuile adressée |
| zooms | 0 à 10, comme demandé |
| calques | les cinq, `landcover` `mountain_peak` `water` `water_name` `waterway` |
| données OSM | planète du 5 octobre 2026 |
| `206` | confirmé, au début **et** au milieu du fichier |

**Le chantier en chiffres** : CCX63 à Helsinki, ~3 heures de location pour
**~1,40 €**. Téléchargement 20 min, construction 13 min 34 s, envoi 59 s — le
reste du temps étant passé à chercher le point d'accès européen.

---

## 12. Détruire le serveur

**Le jour même.** Une instance oubliée facture jusqu'à sa suppression : une
CCX63 laissée un mois coûte 288 €.

D'abord s'assurer qu'on a bien tout, **depuis votre machine** :

```sh
pmtiles show "https://tiles.example.com/planet-z10-2026-10.pmtiles"
curl -s -o /dev/null -D- -H "Range: bytes=0-1023" \
  "https://tiles.example.com/planet-z10-2026-10.pmtiles" | grep -i "^HTTP/"
```

Un `206` et un en-tête lisible : le fichier vit sur R2, le serveur ne sert plus
à rien.

Console Hetzner → le serveur `tuiles` → **Delete**. Pas *Power off* : une
machine éteinte facture toujours son disque et son adresse.

Vérifier qu'il ne reste **ni volume ni adresse IP flottante** facturés à part,
dans les onglets *Volumes* et *Floating IPs* du projet.

Ne garder ni instantané ni sauvegarde : tout est reconstructible avec ce
document, en moins de temps qu'il n'en faut pour payer un mois de stockage.

---

## 13. La licence, et ce qu'elle oblige

Planetiler l'imprime à chaque exécution, et l'archive la porte dans ses
métadonnées. Les tuiles produites sont réutilisables sous **CC-BY** accordée
par l'équipe OpenMapTiles, et la mention visible exigée est, mot pour mot :

> © OpenMapTiles © OpenStreetMap contributors

**Il faut donc ajouter « © OpenMapTiles » aux crédits affichés** par toute
application qui lit ces tuiles. Ce n'est pas optionnel.

---

## 14. Points encore non vérifiés

La liste du 2 octobre comptait quatre points. **Trois sont tombés** le
10 octobre 2026 : les réglages planétaires ont tourné pour de vrai, la taille
de l'archive est mesurée à 2,1 Go, et l'envoi `rclone` vers R2 a réussi avec
son en-tête de cache. Ce qui reste :

- **Les requêtes de plage à travers un domaine Cloudflare *personnalisé*.**
  Le `206` est éprouvé sur l'adresse `pub-….r2.dev`, pas derrière un domaine
  rattaché. Rien ne laisse craindre une différence — c'est le même serveur —
  mais refaites le test de l'étape 10 sur l'adresse définitive.
- **La tenue dans le temps.** Une archive datée du 10 octobre 2026 vieillit :
  les côtes ne bougent pas, les toponymes et les glaciers un peu. Aucune idée
  de la fréquence à laquelle il vaut la peine de reconstruire ; probablement
  une fois l'an, et le § 6 explique pourquoi le nom porte sa date.
- **Le comportement sous charge réelle.** 10 millions de lectures gratuites par
  mois chez R2, puis 0,36 $ le million. Avec ~1,8 ko par tuile et un an de
  cache sur chaque lecture, la facture devrait rester nulle longtemps — mais
  c'est un calcul, pas une observation.

---

## Annexe — l'enchaînement, sans les explications

**Tel qu'il a réellement tourné le 10 octobre 2026.** Les lignes sont aplaties
et les arguments rangés dans des variables : c'est la forme qui survit au
collage, voir l'avertissement de l'étape 3. Un `echo` avant chaque commande
longue.

```sh
# ── sur le serveur ────────────────────────────────────────────────────
apt-get update && apt-get install -y docker.io tmux rclone
systemctl enable --now docker

cd /tmp
curl -sLO https://github.com/protomaps/go-pmtiles/releases/download/v1.31.2/go-pmtiles_1.31.2_Linux_x86_64.tar.gz
tar xzf go-pmtiles_1.31.2_Linux_x86_64.tar.gz
mv pmtiles /usr/local/bin/
df -h /                      # doit montrer ~900 Go libres

tmux new -s tuiles           # ← tout ce qui suit là-dedans
mkdir -p ~/tuiles/data
cd ~/tuiles

# 1. sources fixes + essai à blanc (~1,4 Go, 2 min)
IMG=openmaptiles/planetiler-openmaptiles:latest
V=/root/tuiles/data:/data
D="docker run --rm -v $V $IMG"
F2="--http-timeout=120s --http-retries=5"
$D --only-download --download --area=monaco $F2 --output=/data/m.pmtiles
L=water,waterway,landcover,water_name,mountain_peak
$D --force --area=monaco --minzoom=0 --maxzoom=10 --only-layers=$L --output=/data/m.pmtiles
pmtiles show data/m.pmtiles  # 13 tuiles, z0-10 ; 3 calques seulement = normal

# 2. le pbf planétaire, reprenable (89 Go, 20 min)
cd ~/tuiles/data/sources
U=https://planet.openstreetmap.org/pbf/planet-latest.osm.pbf
curl -L -C - --retry 5 --retry-delay 10 -o planet.osm.pbf $U
cd ~/tuiles

# 3. la construction (13 min 34 s)
M="-e JAVA_TOOL_OPTIONS=-Xmx140g"
D="docker run --rm -v $V $M $IMG"
P=--osm-path=/data/sources/planet.osm.pbf
N="--nodemap-type=sparsearray --nodemap-storage=ram"
O=--output=/data/planet-z10-2026-10.pmtiles
echo $D --force $P --bounds=world --minzoom=0 --maxzoom=10 --only-layers=$L $N $O
$D --force $P --bounds=world --minzoom=0 --maxzoom=10 --only-layers=$L $N $O

# 4. contrôle (les CINQ calques doivent être là)
F=data/planet-z10-2026-10.pmtiles
ls -lh $F
pmtiles verify $F
pmtiles show $F | head -11
pmtiles show --metadata $F | grep -o '"id":"[a-z_]*"'

# 5. envoi (59 s)
export R2_ACCOUNT=…
export R2_KEY=…
read -rs R2_SECRET
export R2_SECRET
export RCLONE_S3_PROVIDER=Cloudflare
export RCLONE_S3_ENDPOINT=https://$R2_ACCOUNT.eu.r2.cloudflarestorage.com
export RCLONE_S3_ACCESS_KEY_ID=$R2_KEY
export RCLONE_S3_SECRET_ACCESS_KEY=$R2_SECRET
export RCLONE_S3_NO_CHECK_BUCKET=true
export RCLONE_HEADER_UPLOAD="Cache-Control: public, max-age=31536000, immutable"
B=:s3:<NOM-DU-BUCKET>/planet-z10-2026-10.pmtiles
echo $B
rclone copyto $F $B -P
rclone lsjson --metadata :s3:<NOM-DU-BUCKET>   # vérifier cache-control
```

L'adresse du point d'accès ci-dessus est la variante **européenne**, celle qui
a fonctionné ; retirez le `.eu.` si votre bucket est en juridiction mondiale.

```sh
# ── depuis votre machine, AVANT de détruire ───────────────────────────
# ouvrir l'accès r2.dev dans Cloudflare, puis :
curl -s -o /dev/null -D- -H "Range: bytes=0-16383" "<URL>" | grep -iE "^HTTP/|content-range"
# doit répondre 206 Partial Content

# ── puis DÉTRUIRE la machine dans la console Hetzner ──────────────────
# Delete, pas Power off. Et vérifier Volumes + Floating IPs.
```
