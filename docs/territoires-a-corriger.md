# Ce qui cloche dans le fond de carte

Relevé fait pendant la traduction des 1 540 noms, puis complété par un balayage
systématique de la base — vocabulaire moderne posé sur des dates anciennes,
régimes brefs qui durent des siècles, ancres éloignées du reste de leurs
tranches, noms très proches les uns des autres.

Le fond de carte vient de **Cliopatria**, une base collaborative sous licence
CC BY. Ses défauts sont ceux d'un travail de bénévoles : des libellés
approximatifs, des dates recopiées de travers, des entités nommées par leur
chef plutôt que par leur nom. Rien ici n'est un reproche ; c'est une liste de
travail.

> ## ÉTAT : APPLIQUÉ
>
> **78 corrections ont été appliquées**, touchant 261 tranches sur 12 040.
> Aucune tranche n'a été perdue, aucun lavis n'a été cassé. Le journal complet
> est dans la table `polity_corrections` : `select * from archive.polity_corrections
> order by id`.
>
> Ce document reste le dossier de ce qui a été fait. Les cas que je n'ai **pas**
> corrigés sont rassemblés au chapitre « Ce que je n'ai pas touché », à la fin,
> avec la raison de chaque abstention.

> **Attention avant toute correction** : le nom est la **clé primaire** de
> `polity_wash`, qui donne sa couleur à chaque territoire. Renommer dans
> `polities` sans renommer dans `polity_wash` fait perdre son lavis au
> territoire, qui retombe alors sur la couleur tirée de son nom. Les blocs SQL
> du dernier chapitre font les deux.

Trois colonnes partout : le nom tel qu'il est aujourd'hui dans la base, ce qui
cloche, et ce que je propose. La mention **(à vérifier)** signale les cas où je
propose sans certitude.

---

## 1. Ce qui n'est pas un territoire mais une personne

Cliopatria nomme parfois une entité par l'homme qui la tenait. Sur une carte,
le lecteur lit « Perdiccas » posé sur la Mésopotamie et ne peut pas savoir si
c'est un pays, une province ou quelqu'un.

| Dans la base | Ce qui cloche | Proposition |
|---|---|---|
| **Perdiccas** — −323/−319 | Le régent de l'empire d'Alexandre, pas un État | Satrapies de Perdiccas |
| **Polyperchon** — −318/−316 | Idem, son successeur à la régence | Satrapies de Polyperchon |
| **Laomédon** — −323/−319 | Satrape de Syrie après Babylone | Satrapie de Syrie |
| **Li Zicheng** — 1632/1644 | Le chef rebelle ; **l'État qu'il a fondé porte un nom** | Dynastie Shun |
| **Cao Cao** — 197/223 | Le seigneur de guerre. « Cao Wei », son royaume, existe déjà par ailleurs dans la base | Domaine de Cao Cao |
| **Gao Kaidao** — 623/625 | Chef de guerre des Sui finissants ; son État s'appelait Yan | Yan de Gao Kaidao |
| **Wihtgar** — 523/691 | Un chef saxon du VI<sup>e</sup> siècle donné à 168 ans d'histoire de l'île de Wight | Royaume de l'île de Wight |
| **Ânkhouennefer** — −197/−171 | Le pharaon rebelle de Haute-Égypte | Révolte thébaine *(à vérifier)* |
| **Sœurs Trưng** — 43/50 | Les deux sœurs qui menèrent la révolte contre les Han | Royaume des sœurs Trưng |

## 2. Ce qui n'est pas un territoire mais un événement

| Dans la base | Ce qui cloche | Proposition |
|---|---|---|
| **Révolte de Nalyvaïko** — 1595/1599 | Une révolte, pas un État | Cosaques de Nalyvaïko |
| **Révolte des Panthay** — 1856/1872 | Une révolte — mais elle a fondé un État réel, le Pingnan Guo, dit sultanat de Dali | Sultanat de Dali |
| **Restauration de Kenmu** — 1333/1343 | Un épisode politique japonais | Japon de la restauration de Kenmu |
| **Bataillon sacré de Thèbes** — −366/−351 | **Un corps d'infanterie**, donné pour un territoire ; ce que la carte montre est l'hégémonie thébaine | Hégémonie thébaine |
| **Occupation de Halytch-Volhynie** — 1056/1240 | Dix tranches sur 184 ans nommées « occupation », sans dire par qui | Halytch-Volhynie *(à vérifier : contenu à examiner)* |

## 3. Ce qui n'est pas un territoire mais un parti, une armée ou un peuple

Ce sont souvent des **guerres civiles**, où le territoire change de main sans
changer de nom d'État. Le libellé a donc une raison d'être ; il est seulement
mal choisi. Quand le camp a eu un nom d'État, je le propose.

| Dans la base | Ce qui cloche | Proposition |
|---|---|---|
| **Communistes chinois** — 1928/1931 | Le territoire tenu par eux portait un nom | République soviétique du Jiangxi |
| **Parti communiste chinois** — 1932/1949 | Un parti | Zones soviétiques chinoises *(à vérifier)* |
| **Coalition anti-Kuomintang** — 1930/1931 | Une alliance de seigneurs de guerre | Coalition des plaines centrales |
| **Kuomintang** — 1917/1929 | Un parti ; l'État était la République de Chine | Chine nationaliste |
| **Parti Baas arabe socialiste** — 1967/1972 | Un parti ; « Syrie baasiste » existe déjà dans la base pour la même chose | Syrie baasiste *(fusionner)* |
| **Khmers rouges** — 1976/1978 | L'État s'appelait le Kampuchéa démocratique | Kampuchéa démocratique |
| **Moudjahidines** — 1987/2024 | Désigne un camp, et court jusqu'à aujourd'hui | À découper *(voir §6)* |
| **Taliban** — 1996/2005 | L'État s'appelait l'Émirat islamique d'Afghanistan | Émirat islamique d'Afghanistan |
| **France libre** — 1940/1944 | Correct historiquement, mais c'est un mouvement | Afrique-Équatoriale française libre *(à vérifier)* |
| **Forces armées polonaises** — 1918 | Une armée | Pologne, 1918 *(à vérifier)* |
| **Partisans yougoslaves** — 1944 | Un mouvement | Yougoslavie des partisans |
| **Nationalistes espagnols** — 1936/1938 | Un camp de guerre civile | Zone nationaliste |
| **Nationalistes italiens** — 1848 | Un camp | Insurrections de 1848 *(à vérifier)* |
| **Nationalistes hongrois** — 1849/**1957** | Un camp, et **un siècle d'écart** entre les deux tranches | À découper *(voir §6)* |
| **Monarchistes mexicains** — 1864 | Un camp ; l'État s'appelait le Second Empire mexicain | Second Empire mexicain *(fusionner)* |
| **Maderistes** — 1911 | Un camp de la révolution mexicaine | Zone maderiste |
| **Communistes cubains** — 1958/1959 | Un camp | Zone rebelle cubaine |
| **Nationalistes cubains** — 1895/1899 | Un camp de la guerre d'indépendance | Cuba insurgée |
| **Huguenots** — 1622/1631 | Un groupe confessionnel ; les places de sûreté avaient un statut | Places de sûreté protestantes |
| **Sikhs** — 1709/1717 | Un peuple ; l'État était l'éphémère État de Banda Singh | Soulèvement sikh *(à vérifier)* |
| **Polonais** — 1830/1833 | Un peuple ; il s'agit de l'insurrection de Novembre | Royaume de Pologne insurgé |
| **Serbes** — 1805/1915 | Un peuple, sur 110 ans et 14 tranches | À découper *(voir §6)* |
| **Tibétains** — 850/1259 | Un peuple, pour la période de fragmentation | Tibet de la fragmentation |
| **Mexicains** — 1811/1819 | Un peuple ; il s'agit des insurgés | Insurgés mexicains |
| **Magnats danois** — 1333/1351 | Une noblesse, pas un État | Danemark des magnats |
| **Coalition athénienne** — −323/−257 | Une alliance ponctuelle | Ligue de Corinthe *(à vérifier)* |

## 4. Titres faux ou douteux

| Dans la base | Ce qui cloche | Proposition |
|---|---|---|
| **Royaume de Monaco** — 1815/1939 | **Monaco n'a jamais été un royaume**, et la « Principauté de Monaco » (1642-2024) couvre déjà la même période dans la même base | Fusionner dans Principauté de Monaco |
| **Comté de Brabant** — 1260/1430 | Le Brabant était un **duché** depuis 1183 | Duché de Brabant |
| **Comté de Béarn** — 1385/1452 | Le Béarn était une **vicomté** | Vicomté de Béarn |
| **Confédération des Barghawata** — 793/1065 | L'anglais disait *Conference*, qui n'a pas de sens ici ; j'ai déjà traduit par « Confédération » | *Déjà corrigé par la traduction* |
| **Confédération livonienne** — 1422/1563 | Même cas : l'anglais disait *Conference* | *Déjà corrigé par la traduction* |
| **Dynastie bahranide** — 1260/1520 | Nom inventé ; la période est celle des Ourayirides, Jarwanides puis Jabrides | Dynasties du Bahreïn *(à vérifier)* |
| **Dynastie du Qatar** — 1820/1904 | La dynastie régnante s'appelle Al Thani | Dynastie Al Thani |
| **Sultanat de Yogyakarta** — 1744/1829 | L'anglais disait *Sultan of Yogyakarta*, le souverain et non l'État ; déjà rendu par le sultanat | *Déjà corrigé par la traduction* |
| **République des Ahis** — 1305/1362 | La confrérie des Ahis d'Ankara ; « république » est une facilité d'historien | Confrérie des Ahis *(à vérifier)* |
| **Royaume mosquito** — 1853/1859 | C'était un protectorat britannique, dit royaume par courtoisie | Garder — l'usage dit bien « royaume mosquito » |

## 5. Coquilles

| Dans la base | Ce qui cloche | Proposition |
|---|---|---|
| **Comté de Blois** — 990/1401 | L'anglais écrivait *Blôis*, avec un accent circonflexe qui n'existe pas | *Déjà corrigé par la traduction* |
| **Principauté de Polotsk** — 1056/1249 | L'anglais écrivait *Polotsky* | *Déjà corrigé par la traduction* |
| **Principauté de Regensberg** — 1806/1813 | Il s'agit de **Ratisbonne** (Regensburg) ; Regensberg est un village suisse | Principauté de Ratisbonne |
| **Principauté de Schwarzbourg-Sonderhausen** — 1820/1870 | La principauté s'écrit **Sondershausen** | Principauté de Schwarzbourg-Sondershausen |
| **Royaume de Pajana** — 1572/1587 | Il s'agit du **Pajang**, royaume javanais ; l'ancre le confirme (111, −7) | Royaume de Pajang |
| **Royaume de Dunoding** — 592/625 | L'anglais écrivait *Dunoting* | *Déjà corrigé par la traduction* |
| **Royaume d'Hawaï** — 1791/1894 | L'anglais écrivait *Kingdom of Hawaï'i*, avec un **tréma français** dans un nom anglais | *Déjà corrigé par la traduction* |
| **Royaume de Jaffna**, **Dictature des colonels**, et 24 autres | Minuscules irrégulières en anglais : *Jaffna kingdom*, *Greek junta*, *Zirid dynasty*… | *Déjà corrigé par la traduction* |
| **Changshan** — −206/−204 | L'anglais écrivait *Chang-shan*, avec un trait d'union | *Déjà corrigé par la traduction* |
| **Han** (−404/−203) et **Hán** (−206/−204) | Deux entités réellement différentes — l'État des Royaumes combattants et l'un des Dix-huit Royaumes — **distinguées par un seul accent** | Han (Royaumes combattants) / Han de Zheng Chang |

## 6. Dates impossibles

Les plus graves : ce sont elles qui mettent un territoire sur la carte au
mauvais siècle.

| Dans la base | Dates portées | Dates réelles | Proposition |
|---|---|---|---|
| **Grands Yuan** | −110 → 50 | 1271 → 1368 | Tranches à réexaminer : il s'agit presque sûrement d'autre chose sous ce nom |
| **Fédération arabe hachémite** | 1415 → 1439 | février → août 1958 | Idem : quatre siècles et demi d'écart |
| **République populaire de Zanzibar** | 1856 → 1889 | 1964 | Renommer en Sultanat de Zanzibar, qui est ce qui existait alors |
| **Royaume de Naples (napoléonien)** | 1762 → 1814 | 1806 → 1815 | Scinder : Royaume de Naples jusqu'en 1806, napoléonien ensuite |
| **Royaume de Grande-Bretagne** | 1709 → **2024** | 1707 → 1801 | Découper : Royaume-Uni à partir de 1801 |
| **République batave napoléonienne** | 1803 → **1872** | 1801 → 1806 | Découper ; voir aussi §7, l'ancre est en Afrique du Sud |
| **Estado Novo** | 1926 → **2024** | 1933 → 1974 | Découper : République portugaise après 1974 |
| **Antilles néerlandaises** | 1815 → **2024** | 1954 → 2010 | Découper |
| **Nouvelle-Néerlande** | 1622 → **1802** | 1614 → 1674 | Découper ; voir aussi §7 |
| **Moudjahidines** | 1987 → **2024** | 1979 → 1992 | Découper : État islamique d'Afghanistan, puis Taliban, puis République |
| **Nationalistes hongrois** | 1849 → **1957** | deux épisodes sans rapport | Scinder : 1849 (révolution) et 1956 (insurrection) |
| **Serbes** | 1805 → 1915 | 14 tranches, trois régimes | Scinder : Serbie insurgée, Principauté, Royaume |
| **Kapisa** | 1475 → 1506 | région antique, jusqu'au VII<sup>e</sup> s. | À réexaminer : probablement le Kafiristan |
| **Petite Horde** | 1564 → 1737 | fondée vers 1715 | Début à revoir |
| **Protectorat des Contrées occidentales** | 117 → 601 | par intermittence, Han puis Tang | Découper par dynastie *(à vérifier)* |

## 7. Positions qui démentent le nom

Treize territoires portent une ancre très loin de ce que leur nom annonce.
Deux causes distinctes, qui ne se corrigent pas de la même façon.

### Vraies erreurs de position

| Dans la base | Ancre portée | Où ce devrait être |
|---|---|---|
| **Nouvelle-Calédonie** — 1856/1859 | 106, 10 — **Viêt Nam** | 165, −21 |
| **Colonie de Freetown** — 1788/1796 | 22, −32 — **Afrique du Sud** | −13, 8 (Sierra Leone) |
| **Dynastie Qajar** — 1788/1923 | 113, 0 — **Bornéo** | 54, 33 (Iran) |
| **Maynila** — 1521/1599 | 128, 26 — **Ryūkyū** | 121, 15 (Manille) |
| **Protectorat du Qatar** — 1947/1955 | 57, 21 — **Oman** | 51, 25 |
| **Louisiane française** — 1800/1804 | −70, 19 — **Haïti** | −92, 35 |
| **Afrique-Équatoriale française** — 1842/1847 | 4, 35 — **Algérie**, et un siècle avant l'AEF | 15, 0 |
| **Inde française** — 1673/1847 | 50, −17 — **La Réunion** | 80, 12 |
| **Nouvelle-Néerlande** — 1622/1802 | −38, −5 — **Brésil** | −74, 41 |
| **République batave napoléonienne** | 22, −32 — **Afrique du Sud** | 5, 52 |
| **Royaume lagide** — −326/−324 | 59, 33 — **Iran** | 30, 27 |

### Empires coloniaux : la métropole n'est pas le plus grand morceau

Ce ne sont pas des erreurs, mais elles se comportent comme telles. Huit noms
ont leur **plus vaste tranche hors de la métropole** :

| Nom | Plus grande tranche | Le reste |
|---|---|---|
| Empire colonial britannique | Australie | Atlantique nord |
| Royaume de Grande-Bretagne | Inde | Îles Britanniques |
| République néerlandaise | Java | Europe |
| République batave | Java | Pays-Bas |
| Royaume de Portugal | Angola | Portugal |
| Afrique portugaise | Angola | Afrique de l'Ouest |
| Inde danoise | Birmanie | Golfe de Guinée |
| Dynastie Qajar | Bornéo | Iran |

**Conséquence directe sur « Étudier »** : la fonction `territories_to_study`
choisit la tranche la plus vaste de chaque nom. Une question montrera donc
l'Inde en attendant « Royaume de Grande-Bretagne », ou Java pour la
« République batave ». C'est une mauvaise question, et c'est réglable sans
toucher aux données — il suffit de changer la règle de choix de la tranche.

## 8. Doublons

| Les deux noms | Ce qui cloche | Proposition |
|---|---|---|
| **République fédérale d'Allemagne** (1950-1990) et **République fédérative d'Allemagne** (1991-2024) | Le même pays sous deux libellés, et le second est **fautif** : c'est « fédérale » dans les deux cas | Un seul nom : République fédérale d'Allemagne |
| **Danemark-Norvège** (1526-1940, 31 tranches) et **Norvège-Danemark** (1046-1055, 1 tranche) | Deux unions réellement distinctes, mais nommées à l'envers l'une de l'autre, ce qui les fait passer pour une faute de saisie | Nommer la seconde : Union de Magnus le Bon |
| **Royaume de Monaco** et **Principauté de Monaco** | Voir §4 : le royaume n'a jamais existé | Fusionner |
| **Parti Baas arabe socialiste** et **Syrie baasiste** | La même chose | Fusionner |
| **Monarchistes mexicains** et **Second Empire mexicain** | La même chose | Fusionner |

## 9. Libellés politiques contemporains

Ils ne sont pas faux, mais ce sont des **positions** dans des conflits ouverts,
dans un atlas par ailleurs historique. À trancher en conscience plutôt qu'à
corriger.

| Dans la base | Période |
|---|---|
| Gaza / Hamas | 2014-2024, 2 tranches |
| Territoires occupés par la Russie | 1992-2024, 2 tranches |
| Territoires palestiniens | 1948-2024, 13 tranches |
| Palestiniens | 1948, 1 tranche |
| République turque de Chypre du Nord | 1976-2024, 2 tranches |
| Kosovo | 2000-2024, 3 tranches |

---

# Ce qui a été fait

## L'outil

Deux fonctions ont été ajoutées à la base, parce que ces corrections se
reprendront :

* `rename_polity(ancien, nouveau)` renomme **des deux côtés à la fois** —
  `polities` et `polity_wash`, dont le nom est la clé primaire. Quand le nom
  d'arrivée existe déjà, c'est une fusion : le lavis du nom qui disparaît est
  supprimé au lieu de buter sur la clé.
* `fork_polity_wash(ancien, nouveau)` donne au nom nouveau le lavis de son
  parent, pour qu'un territoire qu'on vient de découper ne change pas de
  couleur sous les yeux du lecteur.

Et une table, `polity_corrections`, qui garde l'avant, l'après, la raison et le
nombre de tranches. Le dictionnaire `polity_french` dit comment on est passé de
l'anglais au français ; il ne disait pas ce qu'on a corrigé ensuite.

## Le compte

| | corrections | tranches |
|---|---|---|
| Renommages de nom entier | 47 | 141 |
| Découpages sur l'année ou la position | 28 | 112 |
| Reprises de mes propres erreurs | 3 | 8 |
| **Total** | **78** | **261** |

Les noms sont passés de 1 540 à 1 545 : quatre fusions en ont retiré, et les
découpages en ont créé davantage.

## Les découpages, en détail

Un renommage ne suffisait pas pour ceux-là : un même nom portait deux États,
deux siècles ou deux continents.

| Nom d'origine | Est devenu |
|---|---|
| Royaume de Grande-Bretagne (1709-2024, 38 tranches) | Royaume de Grande-Bretagne (1709-1799), Royaume-Uni (1800-2024), Arabie sous protection britannique (2 tranches d'Oman) |
| Serbes (1805-1915) | Serbie insurgée, Principauté de Serbie, Royaume de Serbie |
| Nouvelle-Néerlande (22 tranches, 3 continents) | Nouvelle-Néerlande (New York), Brésil néerlandais, Guyane néerlandaise |
| Antilles néerlandaises | Antilles néerlandaises (3), Guyane néerlandaise (11) |
| République batave napoléonienne (aucune tranche aux Pays-Bas) | Colonie du Cap, Côte-de-l'Or néerlandaise |
| Estado Novo (1926-2024) | Afrique portugaise (1926-1975), Cabinda (après 1979) |
| Moudjahidines (1987-2024) | Moudjahidines afghans, État islamique d'Afghanistan, Rébellion syrienne |
| Nationalistes hongrois (1849 et 1956) | Hongrie révolutionnaire, Insurrection de Budapest |
| Royaume de Naples (napoléonien) (1762-1814) | Royaume de Naples (jusqu'en 1805), Royaume de Naples (napoléonien) (1806-1814) |
| Royaume lagide (−331 à −28) | Empire macédonien (les 2 tranches d'avant −320), Royaume lagide |

Et quatre tranches isolées, chacune à des milliers de kilomètres de son nom :
la Cochinchine étiquetée « Nouvelle-Calédonie », Saint-Domingue étiquetée
« Louisiane », une tranche du Cap étiquetée « Freetown », et les îles
Sous-le-Vent emportées avec la Guyane.

## La trouvaille

**« Grands Yuan » n'était pas la dynastie Yuan.** Quatre tranches de
cinquante mille kilomètres carrés en Ferghana, datées de −110 à 50 — c'est
**Dayuan** (大宛), le royaume que les Han ont trouvé au bout de la route de la
soie. La confusion vient du nom lui-même : 大宛 et 大元 se translittèrent
pareil en anglais. Renommé « Dayuan (Ferghana) ».

## Mes propres erreurs, et ce qu'elles enseignent

Trois corrections ont dû être reprises, et toutes les trois pour la même
raison — **avoir supposé qu'un reste était homogène**.

1. Après avoir sorti le Royaume-Uni des tranches postérieures à 1800, j'ai
   renommé *tout ce qui restait* en « Arabie sous protection britannique ». Ce
   qui restait comprenait les sept tranches d'avant 1800, qui sont les îles
   Britanniques et portaient le bon nom.
2. J'ai renommé « Royaume de Serbie » en « médiéval » d'un bloc pour libérer le
   nom. Le nom couvrait déjà une tranche de 1880-1884 : j'ai donc étiqueté un
   XIX<sup>e</sup> siècle comme médiéval.
3. J'ai trié les colonies néerlandaises d'Amérique sur la seule longitude.
   Saint-Eustache et Saint-Martin sont du côté de la Guyane par la longitude et
   à douze degrés d'elle par la latitude.

Les trois ont été rattrapées par un contrôle d'étendue — le même que celui qui
avait fait trouver les défauts de départ. **La vérification valait le travail.**

---

# Ce que je n'ai pas touché

## Faute de pouvoir identifier la forme

Quatre cas où le nom est sûrement faux mais où je ne sais pas par quoi le
remplacer. Les inventer aurait été pire que les laisser.

| Dans la base | Ce qui cloche |
|---|---|
| **Dynastie Qajar** | Une tranche sur vingt-sept est à Bornéo (113° est), les vingt-six autres en Iran. Quelle entité de Bornéo ? Inconnu |
| **Fédération arabe hachémite** | Deux tranches de 223 000 km² en Irak, datées 1415-1439 — la fédération date de 1958. Quel État du XV<sup>e</sup> siècle ? Inconnu |
| **Kapisa** | Région antique, datée 1475-1506. Probablement le Kafiristan, sans certitude |
| **Petite Horde** | Commence en 1564 ; la horde kazakhe cadette se forme vers 1715 |

## Parce que la proposition n'améliorait rien

| Dans la base | Pourquoi je l'ai laissé |
|---|---|
| **Coalition athénienne** (−323/−257) | J'avais proposé « Ligue de Corinthe » : elle date de 337 et n'est pas la même chose. La période est celle de la guerre lamiaque |
| **Nationalistes italiens** (1848) | « Insurrections de 1848 » n'est pas plus un territoire que le nom actuel |
| **Forces armées polonaises** (1918) | « Pologne, 1918 » porte une date dans son nom, ce qu'aucune étiquette de carte ne devrait faire |
| **Protectorat des Contrées occidentales** (117-601) | Le découpage par dynastie demande une source, pas un raisonnement |
| **Royaume mosquito** | L'usage français dit bien « royaume mosquito » |

## Parce que ce n'est pas une erreur

**Les empires coloniaux dont la plus vaste tranche n'est pas la métropole.**
L'Inde pour le Royaume-Uni, Java pour la République néerlandaise, l'Angola
pour le Portugal. Cliopatria range une colonie sous le nom de sa métropole, ce
qui est un choix de modélisation défendable.

Mais il a une conséquence directe : `territories_to_study` choisit la tranche
la plus vaste de chaque nom, donc une question d'étude montrera l'Inde en
attendant « Royaume-Uni ». **Cela se règle dans la fonction, pas dans les
données.**

**Les libellés politiques contemporains** du §9 — Gaza / Hamas, Territoires
occupés par la Russie, Territoires palestiniens, Chypre du Nord, Kosovo. Ils ne
sont pas faux ; ce sont des positions dans des conflits ouverts, et les
trancher n'est pas mon affaire.

---

# Pour défaire

`docs/defaire-territoires-en-francais.sql` remet les noms anglais. **Depuis ces
corrections, seul le second chemin de ce fichier est complet** : celui qui
passe par `polities_english_names`, lequel restitue par identifiant et se
moque des renommages. Le chemin par le dictionnaire `polity_french` ne
retrouvera plus les 78 noms corrigés.

Pour défaire les seules corrections sans défaire la traduction, `polity_corrections`
garde chaque couple avant/après.
