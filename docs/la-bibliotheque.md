# La bibliothèque

Comment la communauté est passée d'un dépôt libre à un fonds composé.

*Virage décidé et appliqué le 14 octobre 2026.*

---

## Ce qui a changé, en une phrase

Le catalogue ne montre plus « ce que chacun a bien voulu partager » mais
« ce qu'un conservateur a relu et publié ». Le reste en découle.

## Pourquoi

À cinquante-six lignes partagées la communauté comptait déjà plusieurs
versions des mêmes faits, et rien pour trancher entre elles. Le problème
n'était pas la quantité mais l'absence d'arbitre : à mille contributions, un
catalogue sans curation est une brocante où chercher ne sert plus à rien.

Le virage a été fait à **cinquante-six lignes partagées, dix copies** — le
moment le moins cher qu'il y aurait jamais eu.

## Les trois décisions qui tiennent tout

**1. La bibliothèque est un compte.** `profiles.library` est vrai sur un seul
compte, et ses lignes `published` *sont* la bibliothèque. Il n'y a pas de
seconde moitié de base de données, et l'outil de curation est l'application
elle-même : on copie une proposition, on la corrige avec les formulaires
normaux, on la publie.

**2. Ce que les gens écrivent n'est pas touché.** Le conservateur en tire une
entrée distincte ; la ligne de l'auteur reste la sienne, inchangée. C'est ce
qui rend tout le reste simple — aucun droit à négocier, aucune donnée qui
bouge sous son propriétaire.

**3. Les copies restent des copies.** On avait envisagé que le lecteur
détienne un *lien* vers l'entrée au lieu d'un exemplaire. Rejeté : toute
requête qui dit « mes événements sont les lignes à mon nom » serait devenue
une union, soit la moitié de l'application à rouvrir — pour un gain que
personne ne voit. Ce qui gênait, c'était trois Carthage **au catalogue**, et
la curation seule y suffit.

## Les deux modèles

| | va dans | se prend comment |
|---|---|---|
| événements, personnages | la bibliothèque | on copie, on peut mettre à jour |
| arbres | plus tard | — |
| territoires, villes | le fond de carte | tout le monde l'a, chacun peut le masquer |
| classeurs | avec l'événement | ce n'est qu'un nom écrit dessus |

**Les villes et les territoires sont à part**, et c'est structurel : ce sont
les deux seuls genres qui possédaient déjà une table « vue par tout le
monde » — `places` et `polities`. Le geste du conservateur n'est donc pas de
publier une entrée qu'on viendra copier, mais de **promouvoir dans le fond**.
Pas de catalogue, pas d'étoiles, pas de ligne par lecteur. Une ville promue
se comporte exactement comme une ville d'OpenHistoricalMap, masquage compris :
aucun concept neuf pour le lecteur.

**Les arbres attendent**, et la règle est écrite pour le jour où ils
entreront : *un contenant n'entre qu'avec son contenu.* Sa composition est
alors réécrite vers les entrées de la bibliothèque. Les deux autres options
ont été écartées — un arbre à trous mutile le travail de son auteur, un arbre
qui traîne son contenu en copies ordinaires fait rentrer la duplication par la
porte de derrière. Et la propriété qui en tombe : **la structure se détache,
les membres restent reliés.** Qui copie un arbre et le réarrange a *son*
arbre, mais ses personnages continuent de recevoir les corrections.

**Les classeurs, eux, ont cessé d'être des contenants** (14 octobre 2026). Un
classeur n'est plus qu'un nom dans `events.folders`, un `text[]`, et
l'importance a rejoint l'événement dans `events.importance`. Ce que la table
`folders` portait en plus de son nom : une photographie de couverture, une
identité dans la bibliothèque, et l'importance du couple (événement,
classeur). La première ne servait qu'au repli de la pastille ; la deuxième
était le problème ci-dessus, avec en prime `copy_folder` et ses 200 événements
d'un geste ; la troisième n'a jamais servi — aucun événement de la base n'a
jamais été rangé dans deux classeurs, et `effectiveImportance`, écrite exprès
pour ce cas, n'avait aucun appelant hors de son test.

Ce qu'on y gagne, et c'est ce qui a décidé : **un nom voyage avec la copie.**
`copy_one_event` emporte `folders` et `importance`, donc qui prend trois
événements carolingiens les reçoit groupés. La question « comment admettre un
classeur sans fabriquer un classeur vide » ne se pose plus : il n'y a plus
rien à admettre.

Le seul vrai défaut du modèle par étiquette est la dérive des noms —
« Carolingiens » tapé deux fois différemment ferait deux sujets. `FolderSelector`
s'en garde : il montre les noms déjà écrits (`folderNames`, déduit de la
collection) et ramène ce qu'on tape à celui qui existe, à la casse et aux
accents près. Et une contrainte, `events_folders_named`, refuse un élément nul
ou vide.

## Le partage, et ce que la case veut dire

`shared` ne partage plus rien avec personne. Elle dit : **l'auteur autorise la
bibliothèque à s'en servir.** Cochée par défaut, partout — l'effort est
demandé à qui ne veut pas contribuer, pas à qui le veut bien.

Pour une ville et un territoire, elle dit autre chose et le texte le dit :
*autorise la promotion dans le fond de carte*, où la chose est reprise telle
quelle. C'est pourquoi `ShareRow` a un `means` facultatif.

Le nom de la colonne est donc faux. **Il sera renommé au dernier passage de
ménage** : vingt-six fonctions le lisaient au début du chantier, dont huit
désormais supprimées, et le renommer tôt aurait voulu dire réécrire les
vingt-six.

## La file de lecture

Avec le partage ouvert par défaut, la file n'est pas un petit tas de
propositions : **c'est la base entière.** D'où `review`, le carnet du
conservateur — une ligne par verdict rendu, et pas de ligne veut dire pas
encore lu.

- `to_review(want, page_size)` — ce qui n'a pas de verdict, le plus récent
  d'abord, tous genres confondus, avec le pseudonyme de l'auteur. **Pas les
  copies** : elles arrivent avec `shared = false`, ne peuvent jamais être
  admises, et faisaient neuf lignes sur dix.
- `judge(about, which, verdict, became, why)` — note le verdict et, pour une
  admission, **recopie la proposition dans le compte de la bibliothèque, la
  publie et coupe son `origin_id`**. Renvoie l'identifiant de l'entrée.

`became` reste accepté pour le seul cas qui le mérite : fondre la proposition
dans une entrée qu'on tient déjà. Mais on ne pouvait pas le fournir — les
quatre `copy_*` exigent `and x.published`, qu'une proposition n'a par
définition pas, et aucune route ne menait d'une ligne en attente à un
exemplaire chez le conservateur. `judge` appelle donc les ouvriers de la
copie, `copy_one_event` et `copy_one_character`, qui ne demandent rien.

Couper `origin_id` n'est pas cosmétique : sans cela l'entrée de la
bibliothèque passerait pour une copie, et la mécanique de mise à jour
voudrait la rafraîchir depuis la ligne privée d'un lecteur. La filiation qui
compte vit dans `review.became` — et **pas** dans `origin_id`, qui tombe le
jour où l'auteur supprime sa ligne ou son compte, alors que l'entrée doit lui
survivre.

`judge` refuse d'admettre une ligne dont l'auteur a décoché la case, comme
`promote_place` et `promote_polity` le faisaient déjà : la même décision doit
valoir pour les cinq genres. Et les arbres lèvent une exception explicite — la
copie d'un arbre ne reprend que les personnages déjà publiés, donc admettre
une proposition d'arbre produirait un arbre à trous, ce qui est pire que
refuser. `judge` ne connaît plus `folder` du tout : un genre inconnu est
refusé par son nom.

`to_review` est la seule porte de l'application qui regarde par-dessus
l'épaule des gens. Elle le vérifie : tout appel venu d'un autre compte que la
bibliothèque est refusé.

Pas d'écran dédié pour l'instant, à dessein. On en construira un quand on
saura, après cinquante éléments triés, ce qui manque vraiment.

## Les notifications

La carte du compte porte une sixième face, **« Mes notifications »**, et un
point de cire sur le disque lui-même : une notification qu'il faut penser à
aller chercher n'est pas une notification.

Trois genres, et aucun n'est stocké :

| genre | ce qu'il annonce | d'où il sort | ce qu'il propose |
|---|---|---|---|
| `admitted` | « votre événement est entré dans la bibliothèque » | `review` | **Rattacher** |
| `promoted` | « votre ville est sur la carte de tous » | `review` | rien, sa ligne a été supprimée |
| `stale` | « une nouvelle version existe » | les dates | **Mettre à jour** |

`my_notices()` les calcule à chaque appel. Une table de notifications
voudrait dire une ligne par détenteur à chaque correction, et elle mentirait
le jour où quelqu'un se met à jour depuis le formulaire, puisque rien
n'irait l'effacer. La seule chose stockée est **ce qu'on écarte**, dans
`dismissed` — et `sort` entre dans sa clé, sans quoi avoir balayé « votre
événement est entré » étoufferait tous les « une nouvelle version existe »
suivants, qui portent la même `(kind, source_id)`. Pour `stale` la date est
comparée : une correction postérieure au balayage ramène la ligne.

**`review.who` existe pour les villes.** Pour un événement l'auteur est
déductible, sa ligne est là ; pour une ville non, puisque la promotion la
supprime. Le lien ne pouvait survivre que dans `review`, et il n'y était pas.

## Rattacher, et pourquoi c'est son geste et pas le vôtre

Admettre une proposition laisse la ligne de son auteur **indépendante**.
`attach(about, which)` est ce qui la lie, et c'est lui qui l'appelle.

Ce qu'il gagne : les corrections, par bouton. Ce qu'il perd est dicté par la
base et non choisi — `copies_stay_private` interdit à une copie d'être
ouverte à la bibliothèque, donc sa case se referme. Elle n'a plus d'objet.

`taken_at` prend **la date du jugement**, et c'est le cœur du mécanisme : à
cet instant l'entrée valait exactement son texte, que `copy_one_event` avait
recopié verbatim. Tout ce qui a été corrigé depuis est donc en retard et lui
est proposé aussitôt. Mettre `now()` l'aurait déclaré à jour en lui laissant
son texte d'origine.

**`wrote_it(about, which)`** ferme la boucle dans l'autre sens : l'auteur
d'une proposition admise rencontre son propre travail dans le catalogue, et
le pied de la carte lui offrait de le copier — il serait reparti avec deux
fois la même chose, sans lien entre les deux. `mine` ne pouvait pas le
savoir, `judge` ayant coupé `origin_id` ; `review` le sait. Les dix endroits
qui renvoient `mine` passent par là.

## La mise à jour d'un exemplaire

Jamais silencieuse. Un bouton **« Mettre à jour »** paraît en tête du
formulaire de modification, et seulement s'il y a du neuf — un bouton
permanent qui répond « vous êtes déjà à jour » apprend à ne plus vérifier.
C'est le geste ; la notification, elle, est la découverte : personne n'ouvre
un formulaire de modification pour voir si quelque chose a changé.

Tout tient dans **une seule colonne**, `taken_at`, le moment où l'on a pris :

- *y a-t-il du neuf ?* → `entrée.updated_at > taken_at`
- *l'ai-je modifié ?* → `mon.updated_at > taken_at`

On avait d'abord songé à y mettre la date de l'entrée au moment de la copie.
Ça ne marche pas : mon `updated_at` vaut alors le moment de la copie, qui est
postérieur, et toute copie fraîche se déclarerait modifiée.

La reprise est **tout ou rien** — champs, photographies, distribution — et
l'avertissement nomme les photographies au lieu de dire vaguement « vos
modifications ». Deux tons : « rien ne sera perdu » si le lecteur n'a pas
touché son exemplaire, l'avertissement complet sinon.

**Le détachement n'a demandé aucune ligne de code.** `stale()` exige
`published` sur l'entrée : une entrée dépubliée ou supprimée cesse
simplement d'apparaître, et l'exemplaire garde tout.

Attention : la substance d'un événement n'est pas que dans sa ligne. Les
tables filles — photos, distribution, membres d'un arbre — **touchent leur
mère** par `touch_parent`, sans quoi ajouter une photographie à une entrée ne
prévient personne.

**`updated_at` suit le contenu, et rien d'autre.** `touch_updated_at` ignore
six colonnes — `stars`, `origin_id`, `taken_at`, `shared`, `published`,
`updated_at` — plus les colonnes générées de la table. Chacune a menti à
quelqu'un : `stars` monte quand un lecteur prend une copie, et annonçait donc
« une nouvelle version existe » à tous les autres détenteurs pour un
compteur de popularité ; `origin_id` et `taken_at` bougent quand on
rattache, et faisaient signaler l'auteur comme ayant modifié sa ligne, ce qui
change le ton de l'avertissement.

Les colonnes générées sont dans la liste pour une raison technique qui coûte
une demi-heure à qui l'ignore : PostgreSQL ne les calcule qu'**après** les
déclencheurs `BEFORE`. Elles sont donc nulles dans `NEW` et pleines dans
`OLD`, et une comparaison `to_jsonb(new) = to_jsonb(old)` est toujours
fausse. La liste est lue dans le catalogue, parce que les quatre tables n'ont
pas les mêmes.

## Plus de signatures, plus de blocage

Une entrée relue, corrigée, parfois fondue à partir de deux versions n'est
pas « de Scribe-1436 ». Les fiches ne signent donc plus rien, et une
encyclopédie non plus.

Ce qui part avec : **le blocage en entier.** Il existait pour qu'un lecteur
puisse écarter le travail d'une personne ; avec un conservateur en amont, il
n'y a plus personne à écarter. Le signalement reste, mais il change de
destinataire : il dit au conservateur qu'il s'est trompé.

Le pseudonyme **n'est pas supprimé** : il est déjà engendré par l'application,
personne ne l'a choisi, et il sert à lire la file — « ces quarante-trois
viennent du même compte » est son signal le plus utile, et un uuid ne se lit
pas. Le champ « Votre nom dans la communauté » a quitté la page du compte,
puisque plus rien ne l'affiche.

## Les pièges, et où ils sont

**`scripts/build-polities.sql` ligne 21.** `delete from public.polities where
not curated` — **la condition est vitale.** Sans elle, reconstruire les
frontières efface les territoires promus à la main, qui ne sont nulle part
ailleurs : la ligne de leur auteur a été supprimée au moment de la promotion.

**Les villes curées sont protégées gratuitement.** `places.ohm_id` est
négatif pour elles, et `scripts/load-places.mjs` ne supprime que
`?ohm_id=gt.0`. Les négatifs étaient réservés avant qu'on en ait eu besoin.

**Un `case` sans `else` lève CASE_NOT_FOUND.** `count_the_star` et
`block_author` en ont un : ajouter un genre sans y ajouter sa branche fait
échouer la copie entière. Les deux ont désormais un `else`.

**`stale()` doit être `security definer`.** La seule politique sur `events`
est « les siennes » : sans cela la jointure vers l'entrée ne trouve rien et
la fonction répond paisiblement qu'il n'y a jamais rien de neuf. Faute
commise, puis corrigée.

**`now()` est l'heure de début de transaction.** Aucun essai en une seule
transaction ne peut prouver la mécanique de mise à jour : la copie et la
correction y portent la même date. Il faut trois transactions réelles.

**Un déclencheur `BEFORE` ne voit pas les colonnes générées.** PostgreSQL les
calcule après lui : elles sont nulles dans `NEW`, pleines dans `OLD`, et
toute comparaison de lignes entière est donc fausse. Voir
`touch_updated_at`, dont le premier correctif n'a servi à rien pour
exactement cette raison.

**Un `security definer` ne suffit pas à régler un accès, il faut aussi le
retirer.** Toutes les fonctions de ce lot finissent par
`revoke execute … from public, anon`, et l'advisor de Supabase est ce qui le
vérifie.

## Ce qui reste

- Le renommage de `shared`, sur la surface réduite.
- La suppression de la table `blocks` et de ses deux fonctions, au même
  passage.
- `profile.ts` et son test valident un pseudonyme que plus aucun champ ne
  saisit. Gardés : ils reflètent la contrainte `profiles_handle_shape`, qui
  est toujours en vigueur sur les pseudonymes engendrés.
- Les arbres, quand le corpus le méritera. `judge` lève une exception
  explicite en attendant, plutôt que de fabriquer un arbre à trous.
- Un fichier orphelin dans le seau : la couverture du classeur
  « Mérovingiens »,
  `c91e5ef6-0c36-427d-a01c-66f5860a186c/folders/362b1a8f-d449-43d3-918b-4382c122d49d/1789391365779.jpeg`.
  Quelques dizaines de kilooctets, et plus personne ne le réclame. À retirer
  par l'API de stockage, pas par un `delete` dans `storage.objects` — qui
  ôterait la ligne et laisserait le fichier.
- Un écran de curation, quand la file le méritera. En attendant, `to_review`
  et `judge` s'appellent depuis l'éditeur SQL, précédés des deux lignes qui
  présentent la session comme la bibliothèque :

  ```sql
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"<l-identifiant-de-la-bibliotheque>"}';

  select * from to_review();
  select judge('event', '<la proposition>', 'admitted', null, 'relu');
  select judge('event', '<la proposition>', 'rejected', null, 'inexact');
  select promote_place('<la ville>', 'city', 'Tite-Live, I, 8');
  ```

- `stars` ne redescend jamais : `count_the_star` ne se déclenche qu'à
  l'insertion, et supprimer une copie laisse le compteur où il est. C'est
  donc un plus-haut-niveau-atteint, pas un nombre de détenteurs.

## Le démontage des classeurs, dans l'ordre où il a eu lieu

Le 14 octobre 2026. L'ordre compte, et c'est la seule chose à retenir de ce
passage si on doit en refaire un semblable : **les colonnes et la reprise des
données d'abord, les fonctions ensuite, les suppressions en dernier.** Une
table qu'une fonction interroge encore ne se supprime pas, et une colonne
remplie après coup laisse une fenêtre où l'application lit du vide.

| migration | ce qu'elle fait |
|---|---|
| `un_classeur_n_est_qu_un_nom` | `events.folders text[]`, `events.importance` |
| `un_nom_de_classeur_n_est_ni_nul_ni_vide` | la contrainte `events_folders_named` |
| `reprendre_le_classement_existant` | les 39 liens deviennent des noms, l'importance la plus forte gagne |
| `copier_un_evenement_emporte_son_classement` | `copy_one_event` emporte les deux colonnes |
| `une_entree_porte_les_noms_de_ses_classeurs` | `shared_event` rend des noms, `thing` nul |
| `juger_ne_connait_plus_les_classeurs` | `judge` sans la branche `folder` |
| `la_file_ne_montre_plus_de_classeurs` | `to_review` sans l'union des classeurs |
| `le_menage_des_photos_oublie_les_classeurs` | `erasable_by_me` sans la couverture |
| `on_ne_signale_ni_ne_compte_un_classeur` | `block_author`, `count_the_star` |
| `le_catalogue_n_a_plus_de_rayon_classeurs` | `shared_folder` |
| `les_portes_des_classeurs_se_ferment` | `search_folders`, `copy_folder` |
| `folder_n_est_plus_un_genre` | les quatre contraintes `kind` |
| `les_classeurs_quittent_la_base` | `event_folders` puis `folders` |

La fonction edge `copy` a été redéployée (version 2) **avant** les
suppressions : son filet `mend` interrogeait encore `folders`, et un `mend`
lancé entre les deux n'aurait ajouté qu'un `souci` au rapport, mais autant ne
pas le provoquer.
