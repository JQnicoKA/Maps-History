# Brancher Apple, Google et Facebook

Le code est écrit et il tient tout seul : **chaque bouton reste invisible tant
que son fournisseur n'est pas configuré**. On peut donc brancher les trois dans
n'importe quel ordre, et l'application marche à chaque étape.

Ce qui suit est le pas à pas des consoles. Rien n'y est devinable, et c'est la
raison d'être de ce fichier.

> **L'identifiant du projet Supabase est `tjncxgllacvugsjinirf`.** Partout
> ci-dessous, l'adresse de retour est donc :
>
> ```
> https://tjncxgllacvugsjinirf.supabase.co/auth/v1/callback
> ```

## Avant tout : trois applications, trois identités

`app.config.ts` fabrique trois applications d'un seul code — voir son
commentaire. Elles ne partagent ni leur bundle identifier ni leur schéma d'URL :

| variante | bundle identifier | schéma |
|---|---|---|
| développement | `com.mapshistory.app.dev` | `mapshistory-dev://` |
| test | `com.mapshistory.app.preview` | `mapshistory-preview://` |
| production | `com.mapshistory.app` | `mapshistory://` |

**Google et Apple délivrent leurs identifiants par bundle.** Il en faut donc un
par variante, ou l'on n'en configure qu'une — celle sur laquelle on travaille —
et on complète plus tard. Le fichier `.env` diffère déjà d'une variante à
l'autre, c'est là que la distinction vit.

## Étape 0 — Les adresses de retour chez Supabase

Tableau de bord → **Authentication → URL Configuration → Redirect URLs**.
Ajoutez les six, une par ligne :

```
mapshistory://reset
mapshistory://auth
mapshistory-dev://reset
mapshistory-dev://auth
mapshistory-preview://reset
mapshistory-preview://auth
```

Les `://reset` existent sans doute déjà : ce sont les liens de réinitialisation
de mot de passe. Les `://auth` sont ceux de la connexion Facebook. **Les deux
chemins sont volontairement différents** : l'application lit les liens de
réinitialisation à la main et enferme alors le lecteur sur « choisissez un mot
de passe ». Une connexion Facebook qui reviendrait par la même porte serait
prise pour une réinitialisation.

Sans ces lignes, Supabase renvoie silencieusement vers le site du projet et le
bouton semble ne rien faire.

---

## Apple

Vous avez le compte développeur, c'est le plus gros du travail. Il reste une
subtilité qui fait perdre une soirée à tout le monde, et elle est signalée en
gras plus bas.

### 1. La capacité, sur chaque App ID

[developer.apple.com](https://developer.apple.com/account) → **Certificates,
Identifiers & Profiles → Identifiers**.

Pour chaque identifiant d'application que vous utilisez
(`com.mapshistory.app`, `.dev`, `.preview`) : ouvrez-le, cochez **Sign In with
Apple**, enregistrez.

Côté code c'est déjà fait : `app.json` porte `ios.usesAppleSignIn: true` et le
greffon `expo-apple-authentication`.

### 2. Un Services ID, pour Supabase

Toujours dans **Identifiers**, bouton **+** → **Services IDs**.

* Description : `HistoryNote Supabase`
* Identifier : `com.mapshistory.app.supabase` (il doit être différent des App ID)

Une fois créé, rouvrez-le, cochez **Sign In with Apple**, puis **Configure** :

* Primary App ID : `com.mapshistory.app`
* Domains and Subdomains : `tjncxgllacvugsjinirf.supabase.co`
* Return URLs : `https://tjncxgllacvugsjinirf.supabase.co/auth/v1/callback`

### 3. Une clé

**Keys** → **+** → cochez **Sign In with Apple**, configurez-la sur le Primary
App ID, puis **Continue → Register**.

Téléchargez le fichier `.p8`. **Il ne peut être téléchargé qu'une fois.** Notez
aussi le **Key ID** (10 caractères) et votre **Team ID** (en haut à droite du
compte développeur).

### 4. Chez Supabase

**Authentication → Providers → Apple**, activez, puis :

| champ | valeur |
|---|---|
| Client IDs | **voir l'encadré ci-dessous** |
| Secret Key | le contenu entier du `.p8`, en-têtes compris |
| Key ID | les 10 caractères notés |
| Team ID | le vôtre |

> **Le champ « Client IDs » doit contenir les bundle identifiers, pas seulement
> le Services ID.** C'est le piège. La feuille native d'Apple signe un jeton
> dont l'audience est le **bundle de l'application** ; le Services ID ne sert
> qu'au chemin par navigateur, dont nous ne nous servons pas. Mettez donc la
> liste, séparée par des virgules :
>
> ```
> com.mapshistory.app,com.mapshistory.app.dev,com.mapshistory.app.preview,com.mapshistory.app.supabase
> ```
>
> Sans les bundles, Supabase refuse le jeton avec un message qui parle
> d'audience invalide, et l'on cherche du côté de la clé pendant deux heures.

Rien à mettre dans `.env` : Apple ne lit aucune variable côté application.

---

## Google

> **Par le navigateur, et non en natif — c'est un revirement, et il a une
> raison technique.** La feuille native a été construite puis retirée : elle
> est incompatible avec Supabase. `AppAuth`, deux couches sous le module
> React Native, pose un `nonce` en clair dans le jeton d'identité ; Supabase,
> lui, exige le nonce **dont le jeton porte l'empreinte SHA-256** :
>
> ```go
> hash := fmt.Sprintf("%x", sha256.Sum256([]byte(params.Nonce)))
> if hash != idToken.Nonce { return "Nonces mismatch" }
> ```
>
> Satisfaire les deux demanderait d'inverser SHA-256. Seule la version payante
> du module permet de poser son propre nonce. Google emprunte donc le même
> chemin que Facebook, où la question ne se pose pas.
>
> Conséquence agréable : **il n'y a plus d'identifiant Google à mettre dans
> l'application.** Un seul client, côté Supabase.

### 1. Le projet

[console.cloud.google.com](https://console.cloud.google.com) → sélecteur de
projet en haut → **Nouveau projet**. Nommez-le `HistoryNote`. C'est gratuit.

### 2. L'écran de consentement

**API et services → Écran de consentement OAuth**.

* Type d'utilisateur : **Externe**
* Nom de l'application : `HistoryNote`
* Adresse d'assistance et coordonnées du développeur : la vôtre
* Domaines autorisés : `supabase.co`
* Champs d'application : `email`, `profile`, `openid` — rien de plus. Ce sont
  les trois que l'application demande, et en demander davantage déclenche une
  vérification par Google.

Tant que l'application est en mode **Test**, seuls les comptes listés dans
**Utilisateurs tests** peuvent se connecter. Ajoutez-y le vôtre. Le passage en
**Production** se fait d'un bouton et, avec ces trois champs seulement, ne
demande pas de vérification.

### 3. Un seul identifiant

**API et services → Identifiants → Créer des identifiants → ID client OAuth.**

* Type : *Application Web*
* Nom : `HistoryNote serveur`
* URI de redirection autorisés : `https://tjncxgllacvugsjinirf.supabase.co/auth/v1/callback`

Il donne un **ID client** et un **code secret**.

Les clients **iOS** et **Android** ne servent plus à rien : ils étaient pour la
feuille native. S'ils existent déjà, laissez-les dormir ou supprimez-les.

### 4. Chez Supabase

**Authentication → Providers → Google**, activez :

| champ | valeur |
|---|---|
| Client ID | l'ID du client Web |
| Client Secret | le secret du client Web |
| Authorized Client IDs | **laissez vide** — il ne servait qu'au natif |

### 5. Dans `.env`

```
EXPO_PUBLIC_GOOGLE_LOGIN=1
```

Rien d'autre : l'application n'a aucun identifiant Google à connaître.

## Facebook

### 1. L'application Meta

[developers.facebook.com](https://developers.facebook.com) → **Mes
applications → Créer une application**.

* Cas d'usage : **Authentifier et demander des données aux utilisateurs avec
  Facebook Login**
* Nom : `HistoryNote`

### 2. Le produit Facebook Login

Dans le tableau de bord de l'application, ajoutez le produit **Facebook Login**,
puis **Facebook Login → Paramètres** :

* URI de redirection OAuth valides :
  `https://tjncxgllacvugsjinirf.supabase.co/auth/v1/callback`
* Laissez *Connexion OAuth du client* et *Connexion OAuth web* activées.

### 3. L'identifiant et le secret

**Paramètres de l'app → Paramètres généraux** : l'**identifiant de l'app** et
la **clé secrète**.

### 4. Chez Supabase

**Authentication → Providers → Facebook**, activez, collez les deux.

### 5. Dans `.env`

```
EXPO_PUBLIC_FACEBOOK_LOGIN=1
```

### 6. Avant la mise en production

Meta demande une **vérification de l'application** pour que d'autres comptes que
les vôtres puissent se connecter, et l'accès à l'adresse électronique
(`email`) en fait partie. Tant que l'application est en mode développement,
seuls les comptes déclarés dans **Rôles** peuvent entrer. Prévoyez du délai :
c'est la plus lente des trois démarches.

---

## Reconstruire

Les modules natifs du projet ont changé — `expo-apple-authentication`,
`expo-web-browser` et `expo-crypto` sont entrés, `@react-native-google-signin`
est ressorti —, donc **la build actuelle ne suffit plus**.

```sh
npm run prebuild
npm run ios
```

`prebuild --clean` régénère `ios/` et `android/` à partir de la configuration.
Les greffons y inscrivent ce qu'il faut : la capacité Sign in with Apple et les
permissions du navigateur. Plus de schéma d'URL inversé : il appartenait à la
feuille native de Google.

## Vérifier que tout tient

1. **Le bouton paraît-il ?** Sinon, c'est `.env` — et il faut relancer `expo
   start`, les variables sont lues au démarrage.
2. **La feuille s'ouvre-t-elle ?** Sinon, c'est la build : avez-vous relancé
   `prebuild` ?
3. **Revient-on connecté ?** Sinon, c'est Supabase : le fournisseur est-il
   activé, et le jeton accepté — voir les gros pièges, Client IDs d'Apple et
   Authorized Client IDs de Google.
4. **Les comptes se rejoignent-ils ?** Inscrivez-vous par adresse, déconnectez-
   vous, revenez par Google avec **la même adresse** : vous devez retrouver vos
   événements. Supabase rattache les identités quand l'adresse est vérifiée des
   deux côtés. Si deux comptes apparaissent dans **Authentication → Users**,
   c'est que l'adresse n'était pas vérifiée — vérifiez que la confirmation par
   courriel est active.

## Ce que le code fait déjà

* **Un compte sans mot de passe est prévu partout.** La page du compte propose
  « Définir un mot de passe » au lieu de « Changer », et la suppression ne
  demande pas un mot de passe qui n'existe pas : elle rouvre la feuille du
  fournisseur comme preuve d'identité. Refermer cette feuille annule la
  suppression — et les photos ne sont effacées qu'**après** la preuve.
* **La déconnexion oublie le compte Google** retenu par le module natif, sans
  quoi le sélecteur rouvrirait sur le même compte sans laisser le choix.
* **Un refus n'est pas une panne.** Refermer une feuille ne montre aucun
  message d'erreur.

## Les marques

Les boutons Google et Facebook portent une lettre dessinée, pas la marque
officielle. **Google et Meta imposent tous deux leur propre logo** dans leurs
règles d'image. Avant la mise en production, déposez les deux fichiers dans
`assets/` et remplacez le composant `Mark` de `SocialSignIn.tsx` — c'est une
dizaine de lignes. Le bouton d'Apple, lui, est le sien : il vient du système et
ne se dessine pas à la main, c'est sa règle.
