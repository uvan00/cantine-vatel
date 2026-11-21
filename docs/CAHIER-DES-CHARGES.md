# Tablée, la cantine sans file : cahier des charges

Hackathon Vatel « Application de gestion de cantine », samedi 21/11/2026, de 8 h à 18 h. Préparé le 19/11/2026.
Ce document porte les choix. Le 19/11/2026, le propriétaire a indiqué que l'organisation accepte le code préparé : le code
a été écrit à partir de ce jour, à plusieurs sessions en même temps, et l'historique des commits porte les vraies dates.
Ce qui est écrit ici est déjà tranché : ne pas reposer au propriétaire une question qui a sa réponse plus bas.

## 1. Le cadre du hackathon

- Guide officiel : tout le code est développé pendant le hackathon ; le plagiat disqualifie ; le dépôt est public, avec des
  commits réguliers ; les outils d'IA et les bibliothèques publiques (Tailwind, etc.) sont autorisés.
- À rendre avant 18 h par le formulaire : le lien du dépôt, l'adresse de la démo en ligne, le README. Le pitch
  (10 diapositives au plus) part par mail avant le passage, du 23 au 25/11/2026 (20 minutes, dont 10 de démo en direct).
- Barème : fonctionnalités 30, expérience et design 20, innovation 20, qualité du code 15, présentation 15.
- Donc : d'abord le minimum obligatoire, qui doit marcher vraiment, ensuite ce qui démarque.

Minimum obligatoire pour être noté :

| Côté | Ce qu'il faut |
|---|---|
| Utilisateur | Inscription et connexion ; menu de la semaine ; réservation d'un repas ; solde et historique |
| Administrateur | Création et modification des menus ; commandes du jour ; tableau de bord avec des statistiques de base |

## 2. L'idée

Une phrase : « Plus de file, plus de gaspillage, plus d'allergie surprise, plus d'espèces. »

| Problème du guide | Réponse de Tablée |
|---|---|
| Files d'attente | On réserve à l'avance et on reçoit un ticket avec un QR. Au comptoir, un scan : servi |
| Gaspillage | La cuisine voit le nombre exact de repas par plat, d'après les réservations, avant de cuisiner |
| Régimes et allergies | Chaque convive a son profil alimentaire. Un plat qui ne lui convient pas est signalé et ne se réserve pas |
| Menus et tarifs peu clairs | Le menu de la semaine, avec la photo, le prix et les allergènes de chaque plat |
| Gestion à la main | Commandes du jour, encaissements et chiffres calculés tout seuls |

Ce qui démarque : on recharge le compte en Mobile Money sans quitter la page, et il est crédité tout seul (Cartflox, section
4.6). En second choix, un seul QR de paiement, le QR universel PI-SPI de la BCEAO, au
lieu d'un QR par opérateur (section 4.6 ; coupé pour le moment depuis le 21/11/2026, restent Cartflox et les espèces). L'argent va directement sur le compte de la cantine : Tablée ne le touche jamais.

## 3. Les quatre rôles

**Le convive (élève ou employé)**
1. Crée son compte (prénom, nom, e-mail, mot de passe, « élève » ou « employé », classe ou service en option) et se connecte.
2. Voit son solde, son ticket du jour s'il a réservé, et le menu de la semaine, jour par jour.
3. Réserve un plat pour un jour : une feuille de confirmation montre le plat, le jour, le prix et le solde après.
4. Annule tant que la clôture n'est pas passée : il est remboursé tout de suite.
5. Montre son ticket au comptoir (QR, et un code court en secours).
6. Dans son compte : solde, historique, profil alimentaire, « Relier un parent » (un code à usage unique), seuil d'alerte, recharger.
7. Note le plat une fois servi (1 à 5).

**Le parent**
1. Crée son compte « parent » et relie son enfant avec le code que l'enfant crée pour lui dans son compte (6 caractères, valable
   15 minutes, pour un seul parent ; depuis le 21/11/2026, le code n'est plus permanent). L'enfant voit ses parents reliés et peut en retirer un.
2. Voit pour chaque enfant : le solde, l'alerte de solde bas, les repas de la semaine (réservé, servi, non retiré).
3. Recharge le compte de l'enfant (section 4.6).
4. Règle le profil alimentaire de l'enfant et le seuil d'alerte.

**L'administrateur de la cantine** (compte créé par les données de démonstration, jamais par l'inscription publique)
1. Tableau de bord : les chiffres du jour et de la semaine (section 4.9) ; depuis le 21/11/2026, aussi ce qui attend
   (recharges, demandes hors délai, repas à vérifier pour une allergie), l'argent du mois comparé aux mêmes jours du mois
   d'avant (encaissé, gagné, dépensé, bilan), les convives (inscrits, actifs, sous leur seuil, argent en dépôt) et
   l'équipe du jour (repas servis et espèces encaissées par chacun, la borne, le Mobile Money).
2. Menus : jour par jour, ajouter un plat au menu (plat existant ou nouveau : nom, description, prix, allergènes,
   portions prévues, photo choisie parmi celles déjà rangées dans `public/plats`), le modifier, le retirer s'il n'a aucune
   réservation, sinon le marquer « épuisé ». Envoyer une nouvelle photo : plus tard.
3. Commandes : par plat, les repas réservés, servis, à servir, et la liste des convives ; aujourd'hui ou demain ; en direct.
4. Scanner : la caméra lit le ticket, le repas passe à « servi » ; saisie du code court en secours.
5. Recharges : les demandes en attente, « Paiement reçu » en deux temps ; recharge en espèces au comptoir.
6. Réglages, « L'équipe de la cantine » : créer un responsable de cantine (nom, e-mail, mot de passe donné de vive
   voix), le désactiver quand il part (ses sessions se ferment, ce qu'il a encaissé et servi reste à son nom), le
   réactiver, lui donner un nouveau mot de passe.

**Le responsable de cantine** (demande du propriétaire du 21/11/2026 ; créé par l'admin, jamais par l'inscription)
1. Tableau de bord du comptoir : le service du jour, ce qui attend, sa caisse du jour (les espèces qu'il a encaissées,
   recharge par recharge), la semaine et demain.
2. Scanner, commandes, pesée des restes, réserver pour un convive, demandes hors délai, repas non retirés, borne,
   feuille du jour.
3. Recharges à confirmer et recharge en espèces : chaque encaissement est noté à son nom (`Recharge.confirmeePar`),
   chaque repas servi aussi (`Reservation.serviPar`).
4. Ne voit pas : l'argent de la cantine (encaissements, ventes, dépenses, bilan, soldes), les menus et leurs prix, les
   messages, les besoins, les réglages et l'équipe, le rapport, l'assistant. La liste est dans `src/lib/roles.ts`.

## 4. Les règles (pures, testées, à un seul endroit)

### 4.1 Les jours et la clôture
- Abidjan est à l'heure GMT : un jour s'écrit « AAAA-MM-JJ », sans fuseau.
- Le menu se planifie jour par jour, n'importe quel jour de la semaine.
- Clôture : 9 h le jour du repas (`HEURE_CLOTURE`), réglable par la cantine de 6 h à midi (page Réglages, section 4.11).
  On réserve et on annule jusqu'à la clôture ; après, plus rien ne bouge, sauf une demande hors délai acceptée (4.10).

### 4.2 Réserver
Une réservation est acceptée seulement si tout est vrai. Sinon, la raison est dite au convive, en une phrase.

| Condition | Phrase si refus (à écrire dans le ton de la section 9) |
|---|---|
| La clôture du jour n'est pas passée | Les réservations de ce jour sont closes |
| Le convive n'a pas déjà un repas ce jour-là | Un repas par jour : tu as déjà réservé |
| Le plat n'est pas épuisé et il reste des portions | Ce plat est complet |
| Le plat convient à son profil alimentaire (4.5) | Ce plat contient de l'arachide, pas pour toi |
| Avec un plafond de la semaine (4.11), ce repas ne le dépasse pas | Ce repas dépasserait ton plafond de la semaine |
| Son solde couvre le prix | Il te manque tant pour ce plat |

### 4.3 L'argent
- Montants en F CFA entiers, affichés par une seule fonction `fcfa()`.
- Le compte d'un convive est un journal de mouvements : recharge (plus), repas (moins), remboursement (plus).
  Le solde est la somme du journal. On ne stocke pas le solde à part. Le solde ne passe jamais sous zéro.
- Réserver et payer : le prix part du solde tout de suite. Annuler avant la clôture rembourse en entier.
  Un repas payé et non retiré n'est pas remboursé : c'est ce qui rend les chiffres de la cuisine fiables.
- Réserver sans payer (demande du propriétaire du 21/11/2026) : l'élève choisit « Au comptoir » ; rien ne bouge sur son
  solde, et la caisse encaisse au scan, en espèces, par Mobile Money ou sur son solde (4.12). Annulé avant la clôture,
  il n'y a rien à rendre ; jamais retiré, rien n'a été encaissé, il n'entre pas dans ce que la cantine a gagné.
- Réservation et mouvement s'écrivent dans la même transaction. Le serveur décide des montants, l'écran les affiche.

### 4.4 Le ticket
- Chaque réservation a un jeton au hasard (32 caractères hexadécimaux) et un code court de 6 caractères sans ambiguïté
  (pas de O, 0, I, 1, L).
- Le QR contient l'adresse `/ticket/<jeton>`. Seul un administrateur connecté peut marquer « servi ».
- Réponses du scan : « Servi » (avec le prénom et le plat) ; « Déjà servi à 12 h 14 » ; « Ce ticket est pour demain » ;
  « Ticket annulé » ; « Ticket inconnu ».
- Sur le ticket du convive, le tampon « SERVI » tombe en direct quand il est scanné.
- Non retiré : une réservation encore « réservée » alors que son jour est passé. C'est calculé, sans tâche planifiée.

### 4.5 Le profil alimentaire
- Allergènes proposés : les quatorze que la réglementation européenne fait déclarer (règlement (UE) n° 1169/2011,
  annexe II), choix du propriétaire du 21/11/2026 (il y en avait neuf) : arachide, poisson, crustacés, œuf, lait, gluten,
  soja, fruits à coque, sésame, céleri, moutarde, sulfites, lupin, mollusques.
- Régimes proposés : sans porc, végétarien.
- Chaque plat déclare ses allergènes, s'il contient du porc et s'il est végétarien.
- Partout où un allergène ou un régime est nommé, son dessin est à côté de son nom, jamais seul (demande du propriétaire
  du 21/11/2026). Les dessins viennent d'une planche dessinée par Codex (`docs/allergenes-planche.png`), découpée par
  `scripts/allergenes.mjs` dans `public/allergenes`.
- Au service, la cantine voit à quoi le convive est allergique : sur la réponse du scanner, dans les commandes du jour et
  sur la feuille de cuisine (« Convives allergiques »). Cette donnée de santé ne sort que pour la cantine.
- Une seule fonction pure rend la liste des incompatibilités entre un profil et un plat. Liste vide : le plat se réserve.
- Sur le menu, un plat incompatible reste visible, grisé, avec sa raison. La mention « d'après ce que la cantine a déclaré »
  figure sous le profil : l'application ne garantit pas la composition des plats.

### 4.6 Recharger
- Qui : le convive pour lui-même, le parent pour son enfant, l'administrateur au comptoir (espèces).
- Montants rapides : 2 000, 5 000, 10 000 F CFA, ou un autre montant entre 500 et 100 000.
- Une demande de recharge reçoit une référence courte (« R-7K2M ») et attend son paiement.
- Paiement en ligne par Cartflox (choix du propriétaire du 20/11/2026, qui remplace celui du 18/11 « jamais par Cartflox ») :
  en paiement NATIF, comme LinkAfr (son `paiement-natif.tsx` est le modèle) : notre formulaire, pour la Côte d'Ivoire
  seulement (pays CI, francs CFA, les opérateurs que le compte ouvre : Wave, Orange Money et MTN MoMo le 20/11/2026).
  Le serveur ouvre le paiement pour le montant de la recharge, débite le téléphone (code Orange #144*82#, appli Wave) et
  relit le paiement avec la clé secrète (page qui relit, page de la cantine qui relit, webhook signé) ; il crédite le
  montant de la recharge s'il est payé en francs CFA pour au moins ce montant, sinon le paiement va dans « À regarder »,
  chez la cantine. Une session ne sert qu'une recharge ; le crédit ne se fait qu'une fois. La page n'a aucune clé.
- **Coupé pour le moment** (21/11/2026, demande du propriétaire) : `PISPI_ACTIF = false` dans `src/lib/recharge.ts`.
  Ni le site ni l'application mobile ne proposent le QR universel ; restent le Mobile Money par Cartflox et les espèces
  au comptoir (la cantine crédite tout de suite, ou dit « Paiement reçu » sur une demande). Remettre `true` le rétablit.
- En second choix, l'écran montre le QR universel PI-SPI, fabriqué avec la bibliothèque officielle de la BCEAO `@pi-spi/qrcode`, strictement
  standard (aucun champ ajouté) : l'adresse de paiement de la cantine (variable `PISPI_ALIAS`, jamais dans le dépôt), le
  montant et la référence. Le payeur le scanne avec son application habituelle.
- Vérifié le 18/11/2026 sur le téléphone du propriétaire : le scanner principal de Wave ouvre un QR PI-SPI pur. Orange
  l'annonce pour Max it sur son site. Pas encore vérifié : MTN MoMo, Moov Money, et l'affichage du montant quand le QR est
  fabriqué par la bibliothèque (essai du propriétaire, voir `FEUILLE-DE-ROUTE.md`). Si le montant ne s'affiche pas : QR
  sans montant, et l'écran dit le montant à taper.
- On ne scanne pas un QR affiché sur son propre téléphone : l'écran le dit et propose « Enregistrer l'image » ; au
  comptoir ou sur un ordinateur, on scanne directement.
- Confirmation du QR universel : l'administrateur touche « Paiement reçu » (deux temps), ce qui écrit le mouvement. C'est
  dit en clair à l'écran et dans le README.

### 4.7 L'alerte de solde bas
- Seuil par convive, 2 000 F CFA par défaut, réglable par le convive ou son parent.
- Sous le seuil : un bandeau chez le convive et chez le parent, avec le solde et le geste « Recharger ».

### 4.8 Les notes
- Une note de 1 à 5 par repas servi, avec un mot en option. La moyenne par plat se lit côté administrateur.

### 4.9 Les chiffres de l'administrateur (toujours calculés depuis la base)
- Aujourd'hui : repas réservés, servis, à servir. Demain : repas réservés par plat.
- La semaine : réservations par jour (le graphique principal, en barres, aujourd'hui en bleu Vatel), plats les plus réservés
  (liste classée), repas non retirés (nombre et part), recharges confirmées (total), note moyenne des plats.
- Pas de chiffre « gaspillage évité » : il faudrait une base de comparaison qu'on n'a pas. On montre réservés, servis,
  non retirés, et les restes pesés.

### 4.10 Les gestes ajoutés le 20/11/2026 (d'après l'étude de six logiciels de cantine)
Étude : `~/projet de restaurant /docs/cantine/analyse-six-logiciels.md`. Demande du propriétaire : « met tout en place ce
qui peut vraiment améliorer le logiciel ».
- **Restes pesés** (`src/lib/restes.ts`) : après le service, la cantine tape le poids des restes de chaque plat du jour,
  en kilos comme sur la balance (« 1,3 ») ; la base garde des grammes (`MenuJour.restes`, vide tant que rien n'est pesé).
  On pèse aujourd'hui ou un jour passé, jamais un jour à venir, de 0 à 200 kg. Le tableau de bord donne, sur les sept
  derniers jours, les restes par repas servi et le plat le plus laissé ; seuls comptent les plats pesés et servis.
- **Qui ne peut pas le manger** (`convivesEcartes` de `src/lib/profil-alimentaire.ts`) : la même règle que pour réserver,
  passée sur tous les profils. Sur les menus à venir et dans la fenêtre d'ajout : « Pas pour 3 convives : arachide 2,
  végétarien 1 ».
- **Réserver pour un convive** (`parLaCantine` de `peutReserver`) : la cantine réserve pour l'élève sans téléphone, avec
  les mêmes règles que lui, clôture comprise (4.1) : un repas par jour, portions, profil, solde, le repas payé sur son
  compte. Le bouton disparaît une fois la clôture passée. Elle peut le servir aussitôt avec le code du ticket. Après la
  clôture, seule une demande hors délai acceptée par la cantine réserve encore (`horsDelai`), le jour même.
- **Repas non retirés** (`/admin/non-retires`) : la liste des sept derniers jours, convive par convive, en lecture
  seule. Ils ne sont pas remboursés (4.3). Corrigé le 21/11/2026 à la demande du propriétaire : le remboursement pour
  absence justifiée, ajouté la veille, allait contre cette règle et a été retiré.
- **Feuille du jour** (`/feuille/aujourdhui`, `/feuille/demain`) : les réservés par plat, avec une case à cocher, à
  imprimer en secours si le réseau ou un téléphone lâche.

### 4.11 Nos bonus du 21/11/2026 (ajoutés par l'équipe, les organisateurs acceptent nos propres bonus)
D'après notre étude des logiciels de cantine les plus répandus.
- **La clôture réglable** (`src/lib/reglages.ts`, page `/admin/reglages`) : de 6 h à midi, 9 h par défaut. Partout où
  l'heure s'écrit (accueil, menu, ticket, tableau de bord, commandes, feuille du jour), c'est l'heure réglée.
- **Les heures de passage** (`src/lib/creneaux.ts`) : quand la cantine les ouvre
  (premier passage, fin du service, un passage toutes les 10, 15, 20 ou 30 minutes, une capacité par passage), le convive
  choisit son heure en réservant ; un passage plein ne se choisit plus. L'heure est sur le ticket, au scanner, et les
  commandes du jour comptent les passages. Fermées par défaut.
- **La demande hors délai** (4.10) : après la clôture, le jour même, le convive sans repas demande un plat qui reste ;
  rien n'est payé avant la réponse. La cantine l'accepte (une réservation à son nom, payée sur son solde, et le code du
  ticket s'affiche) ou la refuse, depuis les commandes du jour.
- **La borne d'entrée** (`/borne`) : la tablette de la cantine à l'entrée ; l'élève présente son QR ou tape
  son code, l'écran l'accueille par son prénom. Même règle que le scanner. Depuis le 21/11/2026, elle ne tourne plus sur
  la session de la cantine : la cantine la lance, sa session se ferme sur l'appareil, qui ne garde qu'un laissez-passer
  signé pour valider des tickets (`src/lib/borne.ts`). Elle demande le réseau.
- **Le scanner hors ligne** : le scanner garde une copie des tickets du jour sur l'appareil
  de la cantine ; sans réseau, il sert d'après cette copie avec la même règle, et envoie ces services au serveur dès le
  retour du réseau. Ce que le serveur refuse (servi ailleurs entre-temps) s'affiche « À vérifier ».
- **Les visages** : la photo de profil, ou un avatar dessiné choisi par chacun (le parent pour son enfant), sinon les
  initiales.
- **Les messages de la cantine** (`src/lib/messages.ts`) : la cantine écrit
  (`/admin/messages`) à tout le monde, aux élèves et au personnel, aux parents, ou à ceux qui ont réservé dans la semaine
  et à leurs parents ; elle peut épingler un message en haut, et voit combien de personnes l'ont lu. L'élève et le parent
  le lisent dans l'onglet « Messages » (`/messages`), avec une pastille tant qu'ils ne l'ont pas ouvert.
- **Les favoris et « Nouveau »** (`src/lib/favoris.ts`) : une étoile sur chaque
  plat du menu ; quand un favori est au menu d'un autre jour encore ouvert, le menu le dit. Un plat arrivé à la carte il
  y a moins de deux semaines porte « Nouveau ».
- **Le transfert entre frères et sœurs** (`src/lib/solde.ts`) : sur `/parent`, dès deux
  enfants, le parent fait passer de l'argent d'un compte à l'autre, sans nouvelle recharge ; deux lignes au journal, ce
  qui part arrive au franc près.
- **Le plafond de la semaine** (`src/lib/solde.ts`) : de 500 à 200 000 F CFA de repas par semaine, du lundi
  au dimanche ; au-delà, le menu refuse de réserver (4.2). Le parent le règle pour son enfant ; un élève sans parent
  relié, ou un employé, le règle pour lui. L'élève qui a un parent le voit sans pouvoir le changer.
- **La carte de cantine** (`/carte`) : un QR qui ne change pas, sauf quand on refait la carte (perdue ou photographiée) ; au comptoir, à la borne et au
  scanner hors ligne, il sert le repas réservé du jour, comme le ticket. Le parent l'imprime pour l'enfant sans téléphone.
  Depuis le 21/11/2026, c'est aussi le badge (4.12) : la carte naît avec le compte, et sert même sans réservation.
- **L'assistant de la cantine** (façon LinkAfr, demande du propriétaire du 21/11/2026) :
  - **Où** : un panneau à droite du tableau de bord, ouvert d'office dès 1280 px (sinon un tiroir), qui s'ouvre depuis le rail ou la barre du haut.
  - **Les questions guidées** se répondent avec les vrais chiffres, sans IA : le service du jour, ce qu'il faut préparer demain, le plat qui marche le mieux, les repas non retirés et les recharges en attente.
  - **Les questions libres** partent vers Claude Opus 5.5 seulement si la clé est posée, avec 50 questions par jour au plus pour toute la cantine (choix du propriétaire). On n'envoie que des chiffres et des noms de plats, jamais un nom d'élève (`src/lib/assistant.ts`, testé).
  - **Le fil de la conversation** reste dans le navigateur de la cantine.
- **La comptabilité** (demande du propriétaire du 21/11/2026) : six sous-menus dans Recharges :
  - À confirmer ;
  - Encaissements ;
  - Ventes ;
  - Dépenses ;
  - Bilan ;
  - Soldes.

  Ce qui compte comme quoi :
  - **Gagné** : un repas servi, ou un repas dont le jour est passé sans qu'on vienne le chercher.
  - **Pas encore gagné** : l'argent des recharges, qui reste aux élèves tant qu'ils n'ont pas mangé.
  - **Les dépenses** : elles se notent à la main et ne touchent aucun solde.

  Les règles sont dans `src/lib/comptabilite.ts`, avec leurs essais ; les écritures passent par `operations.ts`.

### 4.12 Le paiement au comptoir, les trois files et le badge (demande du propriétaire du 21/11/2026)
Règles pures dans `src/lib/reservation.ts` (testées), écritures dans `src/lib/operations.ts` (`reserver`, `servir`, `servirAuBadge`).
- **Tout passe par le scan**, pour la traçabilité : chaque repas garde sa file, son paiement, qui l'a servi et quand.
- **Trois files**, fixées quand le repas est créé :
  - *File express* : réservé et payé sur le solde. Un scan, et c'est servi ; la borne d'entrée suffit.
  - *File réservation* : réservé sans payer. Le scan répond « À encaisser » avec le montant ; la caisse choisit le
    moyen (espèces, Mobile Money, ou le solde de l'élève s'il suffit) ; le repas est payé et servi dans la même
    transaction, au nom de celui qui encaisse.
  - *File classique* : sans réservation. La caisse scanne le badge, montre les plats du jour (complet, profil
    alimentaire et plafond déjà vérifiés), l'élève choisit, paie par le même choix de moyens : le repas est créé,
    payé et servi d'un coup.
- **Ce qui ne change pas** : un repas par jour, les portions, le profil alimentaire, le plafond de la semaine (qui
  compte tous les repas, payés ou non), la clôture pour réserver et pour annuler. La borne n'encaisse pas : elle
  renvoie un ticket à payer vers la file réservation, un badge sans repas vers la file classique. Sans réseau, un
  ticket à payer ne se sert pas d'après la copie de l'appareil.
- **L'estimation** : Commandes affiche les trois files et, pour la file classique, les repas à prévoir en plus des
  réservations : la moyenne des repas pris sans réservation les cinq derniers jours de service (le service en cours ne
  compte pas) ; rien tant qu'il n'y a pas d'historique.
- **La démonstration** : `node scripts/files-demo.mts` (enchaîné par `npm run demo`) ajoute des repas inventés dans les
  files réservation et classique, aujourd'hui et sur les cinq derniers jours de service, sans toucher aucun solde.
- **L'argent** : un repas payé en espèces ou par Mobile Money entre dans « l'argent entré » (Encaissements), sans
  passer par le solde de l'élève ; payé en espèces, il entre aussi dans la caisse du jour de la personne qui l'a servi.
  Le Mobile Money au comptoir est déclaré par la caisse : aucun opérateur ne le confirme. Avant de débiter le solde
  d'un élève, la caisse confirme (un repas servi ne se défait plus). Tant qu'il n'est pas encaissé, un repas à payer ne
  compte ni dans « Payé en repas » (rapport de la semaine) ni comme de l'argent gardé (repas non retirés : « jamais
  payé »).
- **Le badge** (`/admin/badges`, admin) : recto (marque Vatel, « Élève » ou « Personnel », visage, nom, classe) et
  verso (le QR de la carte de cantine), 54 mm sur 85,6 mm, à plier ; l'impression se fait par classe ou pour tous,
  quatre par feuille A4 couchée. « Badge perdu » refait la carte : l'ancien QR ne passe plus.

## 5. Les données (`prisma/schema.prisma`)

SQLite ne connaît ni les listes ni les énumérations : les états sont des textes, les listes (allergènes) un texte séparé
par des virgules, lu et écrit par deux fonctions pures testées.

| Table | Ce qu'elle garde |
|---|---|
| Utilisateur (tables de Better Auth) | nom, e-mail, mot de passe haché ; en plus : rôle (convive, parent, admin), profil (élève, employé), classe ou service, allergènes, régimes, code famille (ancien code permanent, plus affiché ni utilisé : le code à usage unique attend dans la table des vérifications), seuil d'alerte, plafond de la semaine (ou vide), jeton de la carte de cantine (ou vide) |
| LienParent | le parent, l'enfant ; unique par couple |
| Plat | nom, description, photo, prix par défaut, allergènes, contient du porc, végétarien |
| MenuJour | le jour, le plat, le prix du jour, portions prévues (ou vide), épuisé ; unique par jour et par plat |
| Reservation | le convive, le menu du jour, l'état (réservée, servie, annulée), le jeton, le code court, l'heure de passage (ou vide), les heures (créée, servie, annulée), qui a servi, la file (express, reservation, classique) et le paiement (solde, a_payer, especes, mobile_money) |
| Reglages | une seule ligne : l'heure de clôture, les heures de passage (ouvertes ou non, début, fin, pas, capacité), les remises des tarifs (prévues, aucune règle ne les applique encore) |
| DemandeRepas | la demande hors délai : le convive, le plat du jour, l'état (en attente, acceptée, refusée), la réservation faite en acceptant |
| Ingredient, LigneRecette | les ingrédients (nom, unité) et la fiche de chaque plat : la quantité d'un ingrédient par portion (bonus 2) |
| MouvementStock | la réserve de la cuisine : chaque livraison (avec son prix, et l'id de sa Depense), chaque sortie pour le service d'un jour, chaque écart d'inventaire ; le stock d'un ingrédient est la somme de ses mouvements (bonus 2, lot 2) |
| Message, MessageLu, Favori | les messages de la cantine (titre, texte, à qui, épinglé) et qui les a lus, les plats favoris de chacun |
| Mouvement | le convive, le genre (recharge, repas, remboursement), le montant signé, le libellé, la réservation ou la recharge liée, l'heure |
| Recharge | le bénéficiaire, le demandeur, le montant, la référence, le moyen (pispi, espèces), l'état (en attente, confirmée, annulée), qui a confirmé, les heures |
| Note | la réservation (unique), le plat, la note, le mot, l'heure |

## 6. Les pages

| Adresse | Pour qui | Ce qu'on y fait |
|---|---|---|
| `/` | tous | Pas de page d'accueil (choix du propriétaire du 21/11/2026) : renvoi vers `/connexion` ; connecté : vers l'accueil de son rôle |
| `/connexion`, `/inscription` | tous | Se connecter (« Rester connecté », l'œil du mot de passe) ; créer un compte convive ou parent. D'après les modèles du propriétaire du 21/11/2026 : à l'ordinateur, le formulaire et le panneau marine à la cloche, avec le menu du prochain jour servi ; au téléphone, le haut marine et la feuille blanche à bascule |
| `/menu` | convive | Solde, ticket du jour, menu de la semaine, réserver, annuler |
| `/ticket/<jeton>` | convive, admin | Le ticket avec son QR, son code court, son état |
| `/compte` | convive, parent | Solde, historique, profil alimentaire, relier un parent, seuil d'alerte, plafond de la semaine |
| `/messages` | convive, parent | Les messages de la cantine ; les ouvrir éteint la pastille de l'onglet |
| `/carte`, `/carte/<jeton>` | convive, parent | La carte de cantine, à montrer ou à imprimer ; l'adresse de son QR mène la cantine au scanner |
| `/recharger`, `/recharger/<id>` | convive, parent | Choisir le montant ; payer par Cartflox dans la page, sinon en espèces au comptoir (le QR universel est coupé) |
| `/parent` | parent | Ses enfants : solde, alerte, repas de la semaine ; relier un enfant |
| `/admin` | admin | Tableau de bord |
| `/admin/menus` | admin | Planifier, créer, modifier. La semaine (choix du propriétaire du 21/11/2026) : la bande des sept jours, avec les plats et les réservations de chacun, « À planifier » s'il manque le menu ; dessous, les plats du jour choisi, aujourd'hui d'office, en grandes cartes avec la jauge des portions |
| `/admin/commandes` | admin | Commandes d'aujourd'hui et de demain, en direct ; peser les restes ; réserver pour un convive |
| `/admin/non-retires` | admin | Repas non retirés des sept derniers jours, convive par convive (lecture seule) |
| `/feuille/<aujourdhui ou demain>` | admin | La feuille du jour à imprimer, hors de la coque de la cantine |
| `/admin/scanner` | admin | Scanner un ticket, ou taper son code court ; sans réseau, d'après la copie des tickets du jour |
| `/borne` | la cantine la lance, puis sans session | La borne d'entrée : l'élève scanne lui-même son ticket, hors de la coque de la cantine |
| `/admin/reglages` | admin | L'heure de clôture et les heures de passage |
| `/admin/badges` | admin | Les badges de cantine, à imprimer par classe ; « Badge perdu » refait la carte (4.12) |
| `/admin/besoins` | admin | Les fiches recettes et les quantités à sortir pour un jour (bonus 2), en quatre vues : le jour (chiffres, alerte allergies, liste de sortie par rayon à cocher, plan de production), la réserve (`?vue=reserve`), les achats (`?vue=achats`, demain ou 7 jours), les coûts (`?vue=couts`) |
| `/admin/plus` | admin | Au téléphone : les rubriques qui ne tiennent pas dans la barre du bas |
| `/admin/recharges` | admin | Paiements Cartflox « À regarder », confirmer « Paiement reçu », recharge en espèces |
| `/admin/recharges/encaissements`, `ventes`, `depenses`, `bilan`, `soldes` | admin | La comptabilité (demande du propriétaire du 21/11/2026), dans le deuxième menu de Recharges : l'argent entré par moyen de paiement ; les repas gagnés (servis ou non retirés), payés pour plus tard ; les dépenses notées à la main (table `Depense`) ; le bilan, gagné moins dépensé ; l'argent des élèves en dépôt. Période jour, semaine, mois ou dates choisies (du, au), export CSV (`/api/admin/compta`) |
| `/admin/messages` | admin | Écrire aux familles, épingler, voir combien l'ont lu, retirer un message |
| `/admin/rapport` | admin | Le rapport d'une semaine, à imprimer, et son CSV (`/api/admin/rapport`) |

« En direct » : relecture toutes les 3 secondes (commandes, ticket, attente de recharge). Pas de notifications push.

## 7. La technique

Versions déjà éprouvées ensemble sur cette machine (dans Tablée et dans le compte unique Aurabana) :

| Brique | Version | Rôle |
|---|---|---|
| Node | 24 | Exécution, essais natifs en TypeScript |
| Next.js, React | 16.3.6, 19.2.8 | Application (App Router, actions serveur) |
| TypeScript | 5, mode strict | |
| Tailwind CSS | 4 | Interface, avec le kit et les jetons de la section 9 |
| hugeicons-react | 0.4 | Icônes |
| Prisma, SQLite | 6.19 | Base dans un fichier (`donnees/cantine.db`) |
| Better Auth | 1.7.4 | Connexion par e-mail et mot de passe, adaptateur Prisma |
| zod | 4 | Validation de chaque action |
| qrcode | 1.5 | QR du ticket |
| @pi-spi/qrcode | 1.0.0 | QR universel de paiement (BCEAO) |
| API de Cartflox | v1 | Paiement Mobile Money natif : session, opérateurs, débit, statut, webhook |
| jsqr | 1.4 | Lecture du QR par la caméra quand le navigateur n'a pas `BarcodeDetector` |
| @anthropic-ai/sdk | 1.12 | La suggestion de la semaine (bonus 5), avec le modèle Claude Opus 5.5, seulement quand la clé est posée |

Rangement du code :
- `src/lib/*.ts` : les règles pures et leurs essais à côté (`solde`, `reservation`, `profil-alimentaire`, `ticket`, `format`, `jours`).
- `src/lib/donnees*.ts` : les lectures de la base, côté serveur seulement.
- `src/app/**/actions.ts` : les actions serveur. Chacune valide son entrée (zod), vérifie la session et le rôle, appelle
  la règle pure, puis écrit.
- `scripts/demo.mts` : les données de démonstration. `README.md`, `.env.example`, `Dockerfile`.

Commandes : `npm run dev` (port 3700), `npm run build`, `npm test`, `npm run lint`, `npm run base` (`prisma db push`),
`npm run demo`. Avant chaque commit : `npx tsc --noEmit`, `npm test`, `npm run lint`.

Sécurité (15 points de « qualité du code ») :
- Le rôle n'est jamais envoyé par le navigateur : champ fermé à la saisie dans Better Auth, posé par le serveur.
  L'inscription publique ne crée que des convives et des parents.
- Chaque page et chaque action vérifie la session et le rôle côté serveur. Un parent ne voit que ses enfants.
- Les montants et les prix sont lus dans la base par le serveur, jamais reçus du navigateur.
- Jeton de ticket tiré au hasard par le module de cryptographie de Node ; un ticket ne se sert qu'une fois.
- Aucun secret dans le dépôt : `.env` ignoré par git, `.env.example` sans valeur.

Pièges déjà rencontrés (à ne pas redécouvrir samedi) :
- Téléphone sur le wifi en développement : déclarer les adresses du réseau local dans `allowedDevOrigins` de la
  configuration Next, sinon la page reste figée.
- La caméra ne s'ouvre qu'en https : le scanner s'essaie sur l'adresse en ligne, pas sur le wifi.
- Un rendu qui dépend de l'heure se fait après le montage de la page, sinon le serveur et le navigateur ne sont pas d'accord.
- `fcfa()` met des espaces fines insécables : dans les essais, comparer sans les espaces.
- Better Auth : générer ses tables avec son outil en ligne de commande, puis `prisma db push`.

## 8. La mise en ligne

- Sur un serveur du propriétaire : l'application dans Docker, derrière nginx, en https ; la base SQLite dans un volume.
- Le serveur, l'adresse, le port et la recette ne s'écrivent pas dans ce dépôt public : ils sont dans la fiche
  `~/.agents/harness/produits/cantine.md`.
- Rien ne part sans le mot « déploie » du propriétaire, pour chaque mise en ligne. Une seule construction Docker à la fois.
- Les valeurs secrètes du serveur sont posées par le propriétaire ou fabriquées sur le serveur sans être affichées.
- Image : Node 24, `next start`, `prisma db push` au démarrage, la base dans le volume `/donnees`.

## 9. Le design

Direction (démarche unslop), validée par le propriétaire : ne pas la lui redemander.
- **Produit.** La cantine où l'on réserve son repas à l'avance, où l'on est servi en montrant son ticket, et où le parent
  recharge le compte de son enfant en Mobile Money.
- **Caractère.** Chaleureux, taquin, net.
- **Monde.** Le self à midi : l'ardoise du menu de la semaine, le plateau, le ticket repas.
- **Moments.** Le ticket repas, dessiné comme un vrai ticket de caisse avec son QR ; les photos des plats.
- **Signature.** Le tampon « SERVI » qui tombe sur le ticket quand il est scanné.

Validation du propriétaire : « Oui, je valide », le 19/11/2026, pour le nom « Tablée », cette direction et le thème clair unique.

Jetons (un seul thème, clair, pour samedi) :

| Jeton | Valeur |
|---|---|
| Couleur de marque | les couleurs de Vatel (vatel.ci), depuis le 21/11/2026 : bleu Vatel 2 #2B85BB, foncé à #2475A6 en fond sous du blanc et à #1F6A96 pour écrire sur du clair ; le bleu Vatel #67B2E8 pour écrire sur du sombre |
| Logo | la marque officielle de Vatel (`public/vatel/`, relevée sur vatel.ci) suivie de « Cantine de Vatel » ; Tablée reste le nom du logiciel, dans l'onglet du navigateur |
| Bouton principal | fond marine Vatel #072A5D, texte blanc ; le bleu reste rare (sélection, chiffre qui compte, tampon) |
| Surfaces | blanc ; fond de page #FAFAFA ; ardoise marine Vatel #072A5D pour l'accueil et l'en-tête du menu |
| Filets | noir à 10 % |
| Sens | réussite #28A745, erreur #D32F2F, attention #FFAB00, adoucis, jamais en décor |
| Police | DM Sans ; IBM Plex Mono pour le ticket seulement ; graisses 400 et 500, 600 rare |
| Rayons | contrôles 10, cartes 16, panneaux 24 |
| Espacements | grille de 4 ; lignes d'une liste toutes à la même hauteur |
| Icônes | hugeicons-react, 20 px, trait 1,8 ; jamais d'icône « étincelles », aucun emoji |
| Chiffres | `tabular-nums`, un seul format par `fcfa()` |

Les écrans, en une ligne chacun :
- **Menu (convive).** L'ardoise en haut avec les jours de la semaine en onglets ; dessous, les plats en cartes blanches,
  grande photo, nom, prix, allergènes ; la carte du solde ; le ticket du jour s'il existe.
- **Ticket.** Papier clair, bord dentelé, IBM Plex Mono : le plat, le jour, le prix, le QR, le code court ; le tampon.
- **Compte.** Le solde en grand, l'historique en lignes égales, le profil alimentaire en cases à cocher.
- **Parent.** Une carte par enfant : solde, alerte, repas de la semaine en cinq pastilles d'état avec leur mot.
- **Recharger.** Le montant, puis le paiement Mobile Money dans la page, la référence pour payer au comptoir (le QR universel, en second choix, est coupé pour le moment).
- **Administrateur.** Barre de côté discrète (Tableau de bord, Menus, Commandes, Scanner, Recharges) ; un seul grand
  graphique ; les commandes en colonnes par plat avec leur nombre en grand.

Écriture : français, « tu », ton chaleureux et un peu taquin. Aucun tiret long, tiret moyen ni point médian dans ce qui
se lit ; guillemets « » ; pas de point d'exclamation ; pas de point à la fin d'un libellé ; aucun chiffre inventé.

Composants : le kit d'interface de Tablée (`sneat.tsx`, `fenetre.tsx`, `icons.tsx`), recopié tel quel, avec ces jetons.
Le code préparé est accepté par l'organisation (dit par le propriétaire le 19/11/2026).

## 10. Les données de démonstration (`npm run demo`)

- Elles créent toujours un service aujourd'hui, demain et les jours ouvrés suivants, pour tout essayer quel que soit le jour.
- Comptes : une administratrice ; Awa, élève, allergique à l'arachide, avec un solde et un ticket pour aujourd'hui ; son
  parent, déjà relié ; un employé ; quelques convives de plus pour remplir les commandes. E-mails en `@cantine.test`.
  Les mots de passe de démonstration sont écrits dans le README (le jury en a besoin), nulle part ailleurs.
- Menu de démonstration, avec les photos de `~/projet de restaurant /public/plats/` (images générées, à dire dans le
  README) : riz sauce arachide (arachide), attiéké poisson (poisson), garba (poisson), kedjenou de poulet, poulet braisé,
  foutou banane, placali, alloco, igname frite, brochettes ; boissons : bissap, gingembre, eau. Prix de démonstration, à
  remplacer par ceux de la cantine si le propriétaire les obtient.
- Un historique de quelques jours (repas servis, un repas non retiré, deux recharges, des notes) pour que le tableau de
  bord et le parent aient quelque chose de vrai à montrer.

## 11. Hors champ samedi, et les bonus dans l'ordre

Hors champ : anglais, notifications push, mode hors ligne (sauf le scanner, section 4.11, et le ticket du jour gardé par
l'application mobile). L'application mobile native, hors champ au départ, a été écrite le 21/11/2026 (React Native, dans
son propre dépôt ; elle appelle `src/app/api/mobile/**`). Restent hors champ :
livraison, paiement hors Côte d'Ivoire.

Bonus, seulement quand la consigne 12 est faite, dans cet ordre :
1. « Ta semaine avec ton solde » : une fonction pure propose un plat par jour selon le solde, le profil et les notes.
   Fait le 21/11/2026 : `src/lib/semaine.ts` (testé) couvre d'abord le plus de jours possible avec le plat le moins cher
   permis par le profil, puis monte vers le mieux noté avec ce qui reste ; sur `/menu`, le bloc replié « Ta semaine ».
2. Les besoins de la cuisine : grammes par portion de chaque plat, multipliés par les réservations (quantités à sortir).
   Fait le 21/11/2026 : `src/lib/besoins.ts` (testé) et `/admin/besoins` ; la fiche de chaque plat (grammes, millilitres
   ou pièces par portion), la liste « À sortir » du jour choisi (demain par défaut), les plats sans fiche signalés.
   Lot 1 du 21/11/2026, validé par le propriétaire, sans changer la base : les chiffres du jour (repas à préparer,
   plats, ingrédients à sortir, déjà sortis) ; l'alerte allergies (un allergène des plats du jour, quand un convive qui
   y est allergique mange ce jour-là) ; la liste de sortie rangée par rayon (`rayonDe`), chaque ingrédient avec son
   image (`public/ingredients`, dessinées par Codex), la part de chaque plat et une case « Sorti » gardée sur
   l'appareil pour ce jour ; le plan de production, plat par plat, sa photo, ses portions (et celles prévues), sa fiche
   multipliée par les réservations et ses restes moyens des 7 jours d'avant, pesés.
   Lot 2 du 21/11/2026, validé par le propriétaire (table MouvementStock, règles pures dans `src/lib/stock.ts`, testées) :
   la réserve (le stock de chaque ingrédient, son prix au kilo, au litre ou à la pièce d'après ses dernières livraisons
   payées, ce que demain en demande, « Couvre demain » ou « Il manque ») ; une livraison payée note aussi sa dépense
   dans la comptabilité (catégorie « ingredients »), dans la même transaction, et la retirer retire les deux ;
   l'inventaire (« Compter ») ; la case « Sorti » de la liste du jour fait sortir la quantité de la réserve, côté
   serveur ; le bon de commande de demain ou des 7 jours (portions prévues, sinon réservations, moins la réserve, avec
   son coût estimé), à imprimer ; le coût matière d'une portion de chaque plat, sa marge et la part du prix qui part
   dans la matière (un prix inconnu est nommé, le coût est alors un minimum).
   Réserve de démonstration (« Oui, pour la démo » du propriétaire) : `node scripts/stock-demo.mts` pose 13 livraisons
   payées au Marché d'Adjamé avec leurs dépenses « ingredients » et un comptage ; il se relance sans doublon, et
   s'enchaîne après `npm run demo`, qui vide les ingrédients.
3. L'application s'installe sur l'écran d'accueil (manifeste et icônes).
   Fait le 21/11/2026 : `src/app/manifest.ts`, « Cantine de Vatel », « Cantine » sous l'icône, ouverte sur l'accueil ;
   l'icône est la marque de Vatel sur fond blanc (`node scripts/icones.mjs`). Chrome la juge installable.
4. Le rapport de la semaine, à imprimer et en CSV.
   Fait le 21/11/2026 : `src/lib/rapport.ts` (testé), mêmes définitions que le tableau de bord (4.9). Sur `/admin/rapport`
   (depuis le tableau de bord, ou « Plus » au téléphone), n'importe quelle semaine jusqu'à la semaine en cours : les
   repas jour par jour (réservés, servis, non retirés, annulés, payé, restes pesés), les plats (servis, non retirés,
   note), les recharges confirmées par moyen. Il s'imprime sur deux feuilles A4 ; le CSV (`/api/admin/rapport`) reprend
   les mêmes tableaux, pour un tableur réglé en français.
5. Une suggestion rédigée par l'IA, si le propriétaire a posé lui-même la clé.
   Fait le 21/11/2026, clé posée par le propriétaire, premier essai réel réussi : en bas de `/admin/rapport`,
   « Rédiger la suggestion » envoie les chiffres du rapport (aucun nom d'élève) au modèle Claude Opus 5.5
   (`src/lib/ia.ts`), qui propose de deux à quatre gestes pour la semaine suivante. La suggestion ne contient aucun
   chiffre ; une réponse qui en contient un n'est pas montrée (`src/lib/suggestion.ts`, testé). Sans clé, le rapport le
   dit et rien ne part. La clé se pose avec `./scripts/cle-ia.sh`, qui l'écrit dans `.env.local` sans l'afficher.

## 12. Les règles du projet (reprises dans le `CLAUDE.md` du dépôt)

- Tout le texte visible en français, en « tu », ton chaleureux et un peu taquin. Aucun tiret long, tiret moyen ni point
  médian ; guillemets « » ; montants par `fcfa()`.
- Aucun chiffre inventé à l'écran ni dans le pitch : il vient de la base ou d'une source citée.
- L'argent se calcule à un seul endroit (`src/lib/solde.ts`, pur, testé). Le serveur décide, l'écran affiche. Un essai
  pour toute règle nouvelle.
- Un commit et un push à la fin de chaque consigne au moins, message en français qui dit ce qui marche.
- Jamais un secret affiché, copié ni commité. Rien en ligne sans le mot « déploie » du propriétaire.
- Avant chaque commit : `npx tsc --noEmit`, `npm test`, `npm run lint`.
