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

> Les étapes 4 à 7 ont été **éprouvées en vrai** sur Monaco puis sur la Suisse
> le 2 octobre 2026 ; les repères chiffrés viennent de là. Les étapes 8 à 10,
> côté R2, n'ont encore été exercées par personne — elles sont écrites avec
> leurs points de vérification.

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
curl -sL -o pmtiles.tar.gz \
  "$(curl -s https://api.github.com/repos/protomaps/go-pmtiles/releases/latest \
     | grep -o 'https://[^"]*Linux_x86_64.tar.gz' | head -1)"
tar xzf pmtiles.tar.gz && mv pmtiles /usr/local/bin/
pmtiles version

# Doit afficher ~900 Go libres
df -h /
```

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
même commande. Compter 15 à 30 minutes sur le réseau d'un serveur loué.

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

| | pbf source | archive z0–10 | tuiles |
|---|---|---|---|
| Monaco | 675 Ko | 46 Ko | 13 |
| Suisse | 522 Mo | 5,2 Mo | 171 |

Deux extrapolations vers la planète, et je ne prétends pas trancher :
**0,8 Go** au prorata du pbf (qui sous-estime, les tuiles de bas zoom ne
grandissant pas avec la source), **18 Go** au prorata des terres émergées (qui
surestime, la Suisse étant un cas dense et les tuiles océaniques quasi vides).

Les deux bornes conviennent : sous 10 Go le stockage R2 est gratuit, à 20 Go
c'est 0,30 $/mois.

---

## 8. Envoyer sur R2, depuis le serveur

**Depuis le serveur, jamais en rapatriant le fichier chez vous.** La machine a
une liaison à plusieurs gigabits ; votre connexion domestique mettrait des
heures à descendre 20 Go pour les remonter ensuite.

### 8.1 Le bucket

Tableau de bord Cloudflare → **R2** → *Create bucket*, nommé `tiles`.

Pour mémoire : 10 Go de stockage et 10 millions de lectures gratuits par mois,
puis 0,015 $/Go et 0,36 $ le million. **L'egress est gratuit sans plafond** —
c'est la seule raison de choisir R2 plutôt qu'un autre stockage objet.

### 8.2 Le jeton

R2 → **Manage API Tokens** → créer un jeton avec droit d'**écriture** sur ce
bucket. Noter l'**Access Key ID**, la **Secret Access Key** et l'**Account ID**.

### 8.3 L'envoi

L'interface web ne convient pas à un fichier de plusieurs gigaoctets. Avec
`rclone`, déjà installé à l'étape 3 :

```sh
cd ~/tuiles

export R2_ACCOUNT=…
export R2_KEY=…
read -rs R2_SECRET        # saisi sans écho, pas dans l'historique
export R2_SECRET

rclone copyto data/planet-z10-2026-10.pmtiles \
  ":s3:tiles/planet-z10-2026-10.pmtiles" \
  --s3-provider=Cloudflare \
  --s3-endpoint="https://$R2_ACCOUNT.r2.cloudflarestorage.com" \
  --s3-access-key-id="$R2_KEY" \
  --s3-secret-access-key="$R2_SECRET" \
  --s3-no-check-bucket \
  --header-upload="Cache-Control: public, max-age=31536000, immutable" \
  --progress
```

Deux détails qui comptent :

- **`--s3-no-check-bucket`** évite un appel de création de bucket que R2
  refuse. Sans lui, l'envoi peut échouer alors que le bucket existe.
- **L'en-tête de cache** : le fichier ne change jamais, et un an de cache évite
  de repayer la même lecture. On ne peut pas le poser après coup sans
  réenvoyer.

> **Si l'envoi échoue sur une erreur de somme de contrôle** avec le client AWS
> plutôt que rclone, c'est une incompatibilité connue entre ses versions
> récentes et R2 : ajouter `--checksum-algorithm CRC32`, ou poser
> `AWS_REQUEST_CHECKSUM_CALCULATION=when_required`. À n'appliquer qu'en cas
> d'échec, cela peut avoir été corrigé entre-temps.

Vérifier que l'objet est bien arrivé, et à la bonne taille :

```sh
rclone ls ":s3:tiles" \
  --s3-provider=Cloudflare \
  --s3-endpoint="https://$R2_ACCOUNT.r2.cloudflarestorage.com" \
  --s3-access-key-id="$R2_KEY" --s3-secret-access-key="$R2_SECRET"
```

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

Puis la vérification de bout en bout, qui lit l'en-tête PMTiles à distance :

```sh
pmtiles show "https://tiles.example.com/planet-z10-2026-10.pmtiles"
```

Mêmes chiffres qu'en local : la chaîne est complète.

---

## 11. Ce qu'on rapporte

- **L'adresse HTTPS** complète du fichier.
- Le **poids**, le **nombre de tuiles**, le **poids moyen par tuile**.
- Le **maxzoom** réellement construit, s'il a fallu descendre à 9.
- La **liste des cinq calques** avec leurs plages de zoom.
- La confirmation du **`206`** sur l'adresse finale.

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

- **Les réglages planétaires** (`nodemap`, `-Xmx`, le dimensionnement de la
  machine) viennent de la documentation de Planetiler. Les essais sont allés
  jusqu'à 522 Mo de source, pas 80 Go.
- **La taille réelle** de l'archive mondiale : voir les deux extrapolations de
  l'étape 7, qui vont de 0,8 à 18 Go. L'étape 7 est là pour les remplacer par
  une mesure.
- **Les requêtes de plage à travers un domaine Cloudflare personnalisé** :
  vérifiées sur un autre hébergeur, pas sur R2. D'où l'étape 10.
- **`rclone` vers R2** : les deux détails signalés à l'étape 8.3
  (`--s3-no-check-bucket`, l'en-tête de cache) viennent de la documentation et
  de retours connus, pas d'un envoi réussi sous mes yeux.

---

## Annexe — l'enchaînement, sans les explications

```sh
# sur le serveur, dans tmux
apt-get update && apt-get install -y docker.io tmux rclone
systemctl enable --now docker
mkdir -p ~/tuiles/data && cd ~/tuiles

# 1. sources fixes (et essai à blanc)
docker run --rm -v "$(pwd)/data":/data \
  openmaptiles/planetiler-openmaptiles:latest \
  --only-download --download --area=monaco \
  --http-timeout=120s --http-retries=5 \
  --output=/data/monaco-z10.pmtiles

# 2. le pbf planétaire, reprenable
curl -L -C - --retry 5 -o data/sources/planet.osm.pbf \
  https://planet.openstreetmap.org/pbf/planet-latest.osm.pbf

# 3. la construction
docker run --rm -v "$(pwd)/data":/data \
  -e JAVA_TOOL_OPTIONS=-Xmx140g \
  openmaptiles/planetiler-openmaptiles:latest \
  --force \
  --osm-path=/data/sources/planet.osm.pbf \
  --bounds=world --minzoom=0 --maxzoom=10 \
  --only-layers=water,waterway,landcover,water_name,mountain_peak \
  --nodemap-type=sparsearray --nodemap-storage=ram \
  --output=/data/planet-z10-2026-10.pmtiles

# 4. contrôle
pmtiles verify data/planet-z10-2026-10.pmtiles
pmtiles show   data/planet-z10-2026-10.pmtiles

# 5. envoi
rclone copyto data/planet-z10-2026-10.pmtiles \
  ":s3:tiles/planet-z10-2026-10.pmtiles" \
  --s3-provider=Cloudflare \
  --s3-endpoint="https://$R2_ACCOUNT.r2.cloudflarestorage.com" \
  --s3-access-key-id="$R2_KEY" --s3-secret-access-key="$R2_SECRET" \
  --s3-no-check-bucket \
  --header-upload="Cache-Control: public, max-age=31536000, immutable" \
  --progress

# 6. et DÉTRUIRE la machine dans la console Hetzner
```
