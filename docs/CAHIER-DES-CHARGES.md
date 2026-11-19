# Tablée, la cantine sans file : cahier des charges

Hackathon Vatel « Application de gestion de cantine », samedi 21/11/2026, de 8 h à 18 h. Préparé le 19/11/2026.
Ce document ne contient aucun code : seulement les choix. Tout le code s'écrit samedi, dans un dépôt vide (règle du guide).
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

Ce qui démarque : on recharge le compte de la cantine avec un seul QR de paiement, le QR universel PI-SPI de la BCEAO, au
lieu d'un QR par opérateur (section 4.6). L'argent va directement sur le compte de la cantine : Tablée ne le touche jamais.

## 3. Les trois rôles

**Le convive (élève ou employé)**
1. Crée son compte (prénom, nom, e-mail, mot de passe, « élève » ou « employé », classe ou service en option) et se connecte.
2. Voit son solde, son ticket du jour s'il a réservé, et le menu de la semaine, jour par jour.
3. Réserve un plat pour un jour : une feuille de confirmation montre le plat, le jour, le prix et le solde après.
4. Annule tant que la clôture n'est pas passée : il est remboursé tout de suite.
5. Montre son ticket au comptoir (QR, et un code court en secours).
6. Dans son compte : solde, historique, profil alimentaire, code famille, seuil d'alerte, recharger.
7. Note le plat une fois servi (1 à 5).

**Le parent**
1. Crée son compte « parent » et relie son enfant avec le code famille de l'enfant (6 caractères, lus dans le compte de l'enfant).
2. Voit pour chaque enfant : le solde, l'alerte de solde bas, les repas de la semaine (réservé, servi, non retiré).
3. Recharge le compte de l'enfant (section 4.6).
4. Règle le profil alimentaire de l'enfant et le seuil d'alerte.

**L'administrateur de la cantine** (compte créé par les données de démonstration, jamais par l'inscription publique)
1. Tableau de bord : les chiffres du jour et de la semaine (section 4.9).
2. Menus : jour par jour, ajouter un plat au menu (plat existant ou nouveau : nom, description, prix, allergènes,
   portions prévues, photo choisie parmi celles déjà rangées dans `public/plats`), le modifier, le retirer s'il n'a aucune
   réservation, sinon le marquer « épuisé ». Envoyer une nouvelle photo : plus tard.
3. Commandes : par plat, les repas réservés, servis, à servir, et la liste des convives ; aujourd'hui ou demain ; en direct.
4. Scanner : la caméra lit le ticket, le repas passe à « servi » ; saisie du code court en secours.
5. Recharges : les demandes en attente, « Paiement reçu » en deux temps ; recharge en espèces au comptoir.

## 4. Les règles (pures, testées, à un seul endroit)

### 4.1 Les jours et la clôture
- Abidjan est à l'heure GMT : un jour s'écrit « AAAA-MM-JJ », sans fuseau.
- Le menu se planifie jour par jour, n'importe quel jour de la semaine.
- Clôture : 9 h le jour du repas (`HEURE_CLOTURE`). On réserve et on annule jusqu'à la clôture ; après, plus rien ne bouge.

### 4.2 Réserver
Une réservation est acceptée seulement si tout est vrai. Sinon, la raison est dite au convive, en une phrase.

| Condition | Phrase si refus (à écrire dans le ton de la section 9) |
|---|---|
| La clôture du jour n'est pas passée | Les réservations de ce jour sont closes |
| Le convive n'a pas déjà un repas ce jour-là | Un repas par jour : tu as déjà réservé |
| Le plat n'est pas épuisé et il reste des portions | Ce plat est complet |
| Le plat convient à son profil alimentaire (4.5) | Ce plat contient de l'arachide, pas pour toi |
| Son solde couvre le prix | Il te manque tant pour ce plat |

### 4.3 L'argent
- Montants en F CFA entiers, affichés par une seule fonction `fcfa()`.
- Le compte d'un convive est un journal de mouvements : recharge (plus), repas (moins), remboursement (plus).
  Le solde est la somme du journal. On ne stocke pas le solde à part. Le solde ne passe jamais sous zéro.
- Réserver débite tout de suite (réserver, c'est payer). Annuler avant la clôture rembourse en entier.
  Un repas réservé et non retiré n'est pas remboursé : c'est ce qui rend les chiffres de la cuisine fiables.
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
- Allergènes proposés : arachide, poisson, crustacés, œuf, lait, gluten, soja, fruits à coque, sésame.
- Régimes proposés : sans porc, végétarien.
- Chaque plat déclare ses allergènes, s'il contient du porc et s'il est végétarien.
- Une seule fonction pure rend la liste des incompatibilités entre un profil et un plat. Liste vide : le plat se réserve.
- Sur le menu, un plat incompatible reste visible, grisé, avec sa raison. La mention « d'après ce que la cantine a déclaré »
  figure sous le profil : l'application ne garantit pas la composition des plats.

### 4.6 Recharger
- Qui : le convive pour lui-même, le parent pour son enfant, l'administrateur au comptoir (espèces).
- Montants rapides : 2 000, 5 000, 10 000 F CFA, ou un autre montant entre 500 et 100 000.
- Une demande de recharge reçoit une référence courte (« R-7K2M ») et attend la cantine.
- L'écran montre le QR universel PI-SPI, fabriqué avec la bibliothèque officielle de la BCEAO `@pi-spi/qrcode`, strictement
  standard (aucun champ ajouté) : l'adresse de paiement de la cantine (variable `PISPI_ALIAS`, jamais dans le dépôt), le
  montant et la référence. Le payeur le scanne avec son application habituelle.
- Vérifié le 18/11/2026 sur le téléphone du propriétaire : le scanner principal de Wave ouvre un QR PI-SPI pur. Orange
  l'annonce pour Max it sur son site. Pas encore vérifié : MTN MoMo, Moov Money, et l'affichage du montant quand le QR est
  fabriqué par la bibliothèque (essai du propriétaire, voir `FEUILLE-DE-ROUTE.md`). Si le montant ne s'affiche pas : QR
  sans montant, et l'écran dit le montant à taper.
- On ne scanne pas un QR affiché sur son propre téléphone : l'écran le dit et propose « Enregistrer l'image » ; au
  comptoir ou sur un ordinateur, on scanne directement.
- Confirmation : l'administrateur touche « Paiement reçu » (deux temps), ce qui écrit le mouvement. C'est dit en clair à
  l'écran et dans le README : confirmation à la main aujourd'hui, par l'API Business de PI-SPI ensuite.
- Jamais par Cartflox ni par une passerelle : choix du propriétaire du 18/11/2026.

### 4.7 L'alerte de solde bas
- Seuil par convive, 2 000 F CFA par défaut, réglable par le convive ou son parent.
- Sous le seuil : un bandeau chez le convive et chez le parent, avec le solde et le geste « Recharger ».

### 4.8 Les notes
- Une note de 1 à 5 par repas servi, avec un mot en option. La moyenne par plat se lit côté administrateur.

### 4.9 Les chiffres de l'administrateur (toujours calculés depuis la base)
- Aujourd'hui : repas réservés, servis, à servir. Demain : repas réservés par plat.
- La semaine : réservations par jour (le graphique principal, en barres, aujourd'hui en vert), plats les plus réservés
  (liste classée), repas non retirés (nombre et part), recharges confirmées (total), note moyenne des plats.
- Pas de chiffre « gaspillage évité » : il faudrait une base de comparaison qu'on n'a pas. On montre réservés, servis,
  non retirés.

## 5. Les données (à écrire samedi dans `prisma/schema.prisma`)

SQLite ne connaît ni les listes ni les énumérations : les états sont des textes, les listes (allergènes) un texte séparé
par des virgules, lu et écrit par deux fonctions pures testées.

| Table | Ce qu'elle garde |
|---|---|
| Utilisateur (tables de Better Auth) | nom, e-mail, mot de passe haché ; en plus : rôle (convive, parent, admin), profil (élève, employé), classe ou service, allergènes, régimes, code famille (unique), seuil d'alerte |
| LienParent | le parent, l'enfant ; unique par couple |
| Plat | nom, description, photo, prix par défaut, allergènes, contient du porc, végétarien |
| MenuJour | le jour, le plat, le prix du jour, portions prévues (ou vide), épuisé ; unique par jour et par plat |
| Reservation | le convive, le menu du jour, l'état (réservée, servie, annulée), le jeton, le code court, les heures (créée, servie, annulée) |
| Mouvement | le convive, le genre (recharge, repas, remboursement), le montant signé, le libellé, la réservation ou la recharge liée, l'heure |
| Recharge | le bénéficiaire, le demandeur, le montant, la référence, le moyen (pispi, espèces), l'état (en attente, confirmée, annulée), qui a confirmé, les heures |
| Note | la réservation (unique), le plat, la note, le mot, l'heure |

## 6. Les pages

| Adresse | Pour qui | Ce qu'on y fait |
|---|---|---|
| `/` | tous | Présentation en un écran, « Se connecter », « Créer un compte » ; connecté : renvoi vers l'accueil de son rôle |
| `/connexion`, `/inscription` | tous | Se connecter ; créer un compte convive ou parent |
| `/menu` | convive | Solde, ticket du jour, menu de la semaine, réserver, annuler |
| `/ticket/<jeton>` | convive, admin | Le ticket avec son QR, son code court, son état |
| `/compte` | convive, parent | Solde, historique, profil alimentaire, code famille, seuil d'alerte |
| `/recharger`, `/recharger/<id>` | convive, parent | Choisir le montant ; le QR universel et l'attente de la cantine |
| `/parent` | parent | Ses enfants : solde, alerte, repas de la semaine ; relier un enfant |
| `/admin` | admin | Tableau de bord |
| `/admin/menus` | admin | Planifier, créer, modifier |
| `/admin/commandes` | admin | Commandes d'aujourd'hui et de demain, en direct |
| `/admin/scanner` | admin | Scanner un ticket, ou taper son code court |
| `/admin/recharges` | admin | Confirmer « Paiement reçu », recharge en espèces |

« En direct » : relecture toutes les 3 secondes (commandes, ticket, attente de recharge). Pas de notifications push.

## 7. La technique

Versions déjà éprouvées ensemble sur cette machine (dans Tablée et dans le compte unique Aurabana) :

| Brique | Version | Rôle |
|---|---|---|
| Node | 24 | Exécution, essais natifs en TypeScript |
| Next.js, React | 16.3.6, 19.2.8 | Application (App Router, actions serveur) |
| TypeScript | 5, mode strict | |
| Tailwind CSS, shadcn/ui | 4 | Interface, avec les jetons de la section 9 |
| hugeicons-react | 0.4 | Icônes |
| Prisma, SQLite | 6.19 | Base dans un fichier (`donnees/cantine.db`) |
| Better Auth | 1.7.4 | Connexion par e-mail et mot de passe, adaptateur Prisma |
| zod | 4 | Validation de chaque action |
| qrcode | 1.5 | QR du ticket |
| @pi-spi/qrcode | 1.0.0 | QR universel de paiement (BCEAO) |
| @yudiel/react-qr-scanner | dernière | Lecture du QR par la caméra (repli : `qr-scanner`) |

Rangement du code :
- `src/lib/*.ts` : les règles pures et leurs essais à côté (`solde`, `reservation`, `profil-alimentaire`, `ticket`, `format`, `jours`).
- `src/lib/donnees/` : les lectures de la base, côté serveur seulement.
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
- Image : Node 24, sortie autonome de Next, `prisma db push` au démarrage.

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
| Vert de marque | #1F7A4A ; #185A33 pour écrire en vert sur du clair |
| Bouton principal | fond #1C1C1C, texte blanc ; le vert reste rare (sélection, chiffre qui compte, tampon) |
| Surfaces | blanc ; fond de page #FAFAFA ; ardoise #1C1C1C pour l'en-tête du menu |
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
- **Recharger.** Le montant, puis le QR universel au centre, la référence, « En attente de la cantine ».
- **Administrateur.** Barre de côté discrète (Tableau de bord, Menus, Commandes, Scanner, Recharges) ; un seul grand
  graphique ; les commandes en colonnes par plat avec leur nombre en grand.

Écriture : français, « tu », ton chaleureux et un peu taquin. Aucun tiret long, tiret moyen ni point médian dans ce qui
se lit ; guillemets « » ; pas de point d'exclamation ; pas de point à la fin d'un libellé ; aucun chiffre inventé.

Composants : shadcn/ui (bibliothèque publique) habillé avec ces jetons. Le kit personnel de Tablée ne se recopie pas tant
que l'organisation n'a pas répondu que le code préparé est accepté. Les captures de Tablée (`captures/`) peuvent servir de
modèle pour l'œil, pas son code.

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

Hors champ : application mobile native, anglais, notifications push, mode hors ligne, livraison, paiement par passerelle.

Bonus, seulement quand la consigne 12 est faite, dans cet ordre :
1. « Ta semaine avec ton solde » : une fonction pure propose un plat par jour selon le solde, le profil et les notes.
2. Les besoins de la cuisine : grammes par portion de chaque plat, multipliés par les réservations (quantités à sortir).
3. L'application s'installe sur l'écran d'accueil (manifeste et icônes).
4. Le rapport de la semaine, à imprimer et en CSV.
5. Une suggestion rédigée par l'IA, si le propriétaire a posé lui-même la clé.

## 12. Les règles du projet (à recopier samedi dans le `CLAUDE.md` du nouveau dépôt)

- Tout le texte visible en français, en « tu », ton chaleureux et un peu taquin. Aucun tiret long, tiret moyen ni point
  médian ; guillemets « » ; montants par `fcfa()`.
- Aucun chiffre inventé à l'écran ni dans le pitch : il vient de la base ou d'une source citée.
- L'argent se calcule à un seul endroit (`src/lib/solde.ts`, pur, testé). Le serveur décide, l'écran affiche. Un essai
  pour toute règle nouvelle.
- Un commit et un push à la fin de chaque consigne au moins, message en français qui dit ce qui marche.
- Jamais un secret affiché, copié ni commité. Rien en ligne sans le mot « déploie » du propriétaire.
- Avant chaque commit : `npx tsc --noEmit`, `npm test`, `npm run lint`.
