  Ce qui casserait en production — sécurité

  1. Le nom de classeur est unique pour toute la base, pas par compte.
  CREATE UNIQUE INDEX folders_name_key ON folders (name) date d'avant
  les comptes. Concrètement : si un utilisateur a un classeur «
  Renaissance », aucun autre compte ne peut en créer un du même nom — il
  reçoit une erreur Postgres incompréhensible, et au passage il apprend
  l'existence d'un classeur qui ne le regarde pas. Correctif : unique 
  (user_id, name).

  2. N'importe quel compte connecté peut supprimer les photos de 
  n'importe qui.
  Ma policy de stockage autorise insert/delete sur tout le bucket dès
  qu'on est connecté (bucket_id = 'event-photos'), et les chemins ne
  sont pas cloisonnés (<eventId>/…). Il faut l'UUID de l'événement pour
  viser un fichier, donc ce n'est pas trivial, mais ce n'est pas une
  barrière non plus. Correctif : préfixer les nouveaux chemins par
  l'identifiant du compte et vérifier (storage.foldername(name))[1] = 
  auth.uid()::text.

  3. Les photos d'un événement supprimé restent dans le bucket, pour 
  toujours.
  deleteEvent (api.ts:763) efface la ligne ; les objets, non.
  deleteCharacter et deleteFolder le font tous les deux — l'événement a
  été oublié. 26 Mo de photos aujourd'hui, et ça ne peut que monter, en
  silence et en facture.

  4. Trois manques côté comptes, dont un bloquant réglementaire.
  Pas de réinitialisation de mot de passe (déjà signalé). Pas de
  suppression de compte : c'est exigé par l'App Store (règle 5.1.1(v))
  et par le RGPD, puisque tu stockes e-mail et photos. Et la protection
  contre les mots de passe fuités reste désactivée côté Supabase.

  5. La clé MapTiler est dans le bundle — inévitable pour une carte côté
  client, mais elle doit être restreinte au bundle id dans le tableau
  de bord MapTiler, sinon elle s'extrait du .hbc en une minute et c'est
  ton quota.

  Ce qui casserait en production — robustesse et coût

  6. Aucun error boundary. Une exception pendant un rendu donne un écran
  blanc en production, sans message ni moyen de repartir. C'est une
  vingtaine de lignes.

  7. Les photos partent en pleine résolution et servent de vignettes.
  Moyenne 364 ko, la plus lourde 2,5 Mo, encodées en base64 en mémoire
  (+33 %). Les mêmes fichiers sont affichés dans des ronds de 44 pt.
  C'est ce qui fera ramer l'app en premier, et le plan gratuit ne donne
  que 5 Go de bande passante par mois. Correctif : redimensionner avant
  l'envoi et demander des miniatures au transformateur d'images de
  Supabase.

  8. Chaque écriture recharge tout le catalogue. refresh()
  (EventsProvider.tsx:156) relit événements + classeurs + personnages +
  arbres, photos et liaisons comprises. Déplacer un personnage d'un cran
  dans un arbre relit tous les arbres. Invisible à 38 événements,
  pénible à 500, inacceptable à 5 000 — et il n'y a ni pagination ni
  fenêtre temporelle sur fetchEvents.

  9. events_chronology_idx ignore user_id. La requête principale filtre
  par compte (RLS) puis trie par année ; l'index qui la porte devrait
  être (user_id, start_year, …).

  10. 130 Mo sur les 500 Mo du plan gratuit, dont 76 Mo pour territories
  (OHM), qui n'est plus la source par défaut depuis le passage à
  Cliopatria. La supprimer libérerait 76 Mo d'un coup — si tu es sûr de
  ne pas y revenir.

  Plus léger, mais qui mérite qu'on s'y attarde

  - Aucun test versionné. Tout ce que j'ai vérifié l'a été dans un bac à
    sable jeté ensuite. rows.ts, viewport.ts, layout.ts, password.ts,
    historicalDate.ts sont purs et se testeraient en une heure, avec un
    npm test et une CI.
  - Aucun rapport de crash (Sentry ou équivalent) : en production, un
    bug chez un utilisateur est un bug que tu ne verras jamais.
  - Pas d'eas.json, et version: 1.0.0 sans buildNumber/versionCode — à
    régler avant la première soumission.
  - Pas de politique de confidentialité ni de CGU : obligatoires à la
    soumission.
  - Textes en dur en français, aucune internationalisation.
  - Tailles de police fixes : l'app ignore les réglages d'accessibilité
    (Dynamic Type), ce qui est un vrai sujet pour une app de lecture.
  - Rien hors-ligne, aucun retry : une coupure réseau pendant un
    enregistrement perd la saisie.
  - Le compte de test a un mot de passe faible (Test123) qui ne
    passerait pas les règles de l'app — à changer ou à supprimer avant
    toute mise en ligne.

  Si tu veux que je m'y mette

  Dans cet ordre, parce que c'est celui du risque : 1 et 3 (une
  migration et dix lignes, une demi-heure), 2 (cloisonnement du
  stockage, plus délicat à cause des 73 fichiers existants), 6 et 7
  (l'écran blanc et le poids des images), puis 4 (suppression de compte,
  qui est un travail de produit autant que de code). Dis-moi par où
  commencer.