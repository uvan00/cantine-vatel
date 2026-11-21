# Tablée, la cantine sans file

Application de gestion de cantine, écrite pour le hackathon Vatel 2026.
En une phrase : « Plus de file, plus de gaspillage, plus d'allergie surprise, plus d'espèces. »

| Problème de la cantine | Ce que fait Tablée |
|---|---|
| Les files d'attente | On réserve à l'avance et on reçoit un ticket avec un QR. Au comptoir, un scan : servi. Trois files, pour que personne ne ralentisse les autres : express (réservé et payé), réservation (réservé, à payer au comptoir), classique (sans réservation, avec son badge) |
| Le téléphone oublié, perdu ou absent | Chaque convive a son badge de cantine, créé avec son compte et imprimé par la cantine : un scan au comptoir, avec ou sans réservation. Tout passe par le scan, donc chaque repas garde sa file, son paiement, qui l'a servi et quand |
| Le gaspillage | La cuisine voit le nombre exact de repas par plat avant de cuisiner, puis pèse les restes de chaque plat après le service |
| Les régimes et les allergies | Chaque convive a son profil alimentaire. Un plat qui ne lui convient pas ne se réserve pas, et la cantine voit, en le mettant au menu, combien de convives ne pourront pas le prendre. Les quatorze allergènes de la réglementation européenne, chacun avec son dessin à côté de son nom ; au service, le scanner, les commandes et la feuille de cuisine disent à quoi un convive est allergique, et signalent un repas déjà réservé qui ne convient plus à son profil |
| Les menus et les prix peu clairs | Le menu de la semaine, avec la photo, le prix et les allergènes de chaque plat |
| La gestion à la main | Commandes du jour, recharges et chiffres calculés tout seuls |

## Les quatre rôles

- **L'élève ou l'employé** : voit le menu de la semaine, réserve un repas en le payant tout de suite avec son solde, ou sans payer
  pour le régler au comptoir, annule jusqu'à la clôture du jour même (9 h par défaut, la cantine la règle) et retrouve
  tout de suite ce qu'il avait payé, montre son ticket ou son badge au comptoir, suit son solde et son historique, règle
  son profil alimentaire, note ses repas.
- **Le parent** : relie son enfant avec le code que celui-ci crée pour lui dans son compte (valable 15 minutes, pour un
  seul parent ; l'enfant peut retirer un parent), voit son solde et ses repas de la semaine (servi, non retiré),
  est prévenu quand le solde est bas, recharge le compte, règle le profil alimentaire.
- **L'admin de la cantine** : planifie les menus (et voit qui ne pourra pas prendre chaque plat), suit les
  commandes d'aujourd'hui et de demain en direct, sert en scannant les tickets, réserve pour un convive sans téléphone
  (jusqu'à la clôture, comme tout le monde), imprime la feuille du jour en secours et les badges de cantine (un badge perdu se refait), pèse les restes après le service,
  voit qui n'est pas venu chercher son repas, confirme les recharges, tient la comptabilité, crée et désactive les
  responsables de cantine (Réglages, « L'équipe de la cantine »), lit son tableau de bord : le service du jour, ce qui
  attend, l'argent du mois comparé aux mêmes jours du mois d'avant, les convives, l'équipe du jour.
- **Le responsable de cantine** (créé par l'admin, depuis le 21/11/2026) : tient le comptoir. Il scanne les tickets
  et les badges, encaisse au scan un repas réservé sans payer (espèces, Mobile Money ou solde de l'élève), sert au badge
  celui qui n'a pas réservé (il choisit son plat et paie sur place), suit les commandes et leurs trois files avec
  l'estimation des repas sans réservation, encaisse les espèces et confirme les recharges, voit sa caisse du jour, répond aux demandes hors
  délai, lance la borne. Il ne voit ni l'argent de la cantine, ni les menus et leurs prix, ni les messages, ni les
  achats, ni les réglages. Ce qu'il sert et ce qu'il encaisse est noté à son nom.

## Essayer

Adresse de la démonstration : https://cantine.jedevui.com

Le manuel, avec captures d'écran (ce que fait l'application, les comptes, un parcours d'essai) :
[`docs/manuel-cantine-vatel.pdf`](docs/manuel-cantine-vatel.pdf).

Comptes de démonstration (personnes et repas inventés pour l'essai, créés par `npm run demo`) :

| Rôle | E-mail | Mot de passe |
|---|---|---|
| Élève (Awa, allergique à l'arachide) | `awa@cantine.test` | `cantine-demo-2026` |
| Parent (Mariam, sa maman) | `mariam@cantine.test` | `cantine-demo-2026` |
| Responsable de cantine (Fatou, au comptoir) | `fatou@cantine.test` | `cantine-demo-2026` |
| Admin de la cantine (Aminata) | `cantine@cantine.test` | `cantine-demo-2026` |

Quand `MODE_DEMO="1"`, la page de connexion propose aussi « Essayer sans compte » : une entrée directe dans les comptes d'Awa
et de Mariam. Ceux de la cantine (Fatou et Aminata) ne s'ouvrent en un clic que sur un ordinateur de développement,
jamais sur un serveur en ligne : la cantine s'y connecte avec son e-mail et son mot de passe.
On peut bien sûr créer son propre compte d'élève, d'employé ou de parent. Un compte de la cantine (admin ou responsable)
ne se crée jamais par l'inscription publique : l'admin crée ses responsables dans les Réglages.

## Lancer en local

Il faut Node 24.

```bash
npm install
cp .env.example .env        # puis mettre une valeur au hasard dans BETTER_AUTH_SECRET (openssl rand -hex 32)
npm run demo                # crée la base SQLite et les données de démonstration, livraisons de la réserve et trois files du comptoir comprises
npm run dev                 # http://localhost:3700
```

Sur un serveur en ligne, ne relance pas `npm run demo` : il remet la base à neuf (comptes, repas, recharges) et rend au
compte de la cantine le mot de passe de démonstration. Pour y remplir les trois files du comptoir, lance seulement
`node scripts/files-demo.mts` : il ajoute des repas de démonstration, n'efface rien et ne double rien.

Vérifier : `npm test` (règles pures), `npx tsc --noEmit`, `npm run lint`.

Les icônes de l'application posée sur l'écran d'accueil (la marque de Vatel sur fond blanc) se refont avec
`node scripts/icones.mjs`, si la marque change.

## Architecture

```text
Navigateur (téléphone d'abord)
   │  pages React rendues par le serveur, actions serveur
   ▼
Next.js 16 (App Router)
   ├─ src/app/(auth)        connexion, inscription
   ├─ src/app/(espace)      le convive et le parent
   ├─ src/app/admin         la cantine
   ├─ src/app/api           routes relues « en direct » (toutes les 3 secondes)
   ├─ src/app/api/mobile    routes JSON de l'application mobile, par jeton
   ├─ src/lib/*.ts          les règles pures, avec leurs essais à côté
   ├─ src/lib/operations.ts tout ce qui écrit dans la base, en transactions
   └─ src/lib/session.ts    qui est connecté, et son rôle (Better Auth)
   ▼
Prisma  →  SQLite (un fichier)
```

- **Next.js 16, React 19, TypeScript strict, Tailwind 4.**
- **Prisma et SQLite** : un fichier, rien à administrer, largement assez pour une cantine. Passer à PostgreSQL ne change
  que deux lignes du schéma.
- **Better Auth** : connexion par e-mail et mot de passe, sessions gardées en base, mots de passe hachés.
- **Le « direct »** : les écrans qui bougent (commandes, ticket, attente d'une recharge) relisent une petite route JSON
  toutes les 3 secondes. Rien à reconnecter sur un wifi fragile.
- **L'application mobile** (React Native, dans son propre dépôt) : elle appelle `src/app/api/mobile/**` avec un jeton
  (`Authorization: Bearer`, greffon `bearer()` de Better Auth). Chaque route vérifie le rôle avec `autorise(...)` et passe
  par les mêmes fonctions que les pages : aucune règle n'est écrite deux fois.

### Les règles, à un seul endroit chacune

| Règle | Fichier | Essais |
|---|---|---|
| Les jours et la clôture (9 h par défaut, réglable) | `src/lib/jours.ts`, `src/lib/reglages.ts` | `jours.test.ts`, `reglages.test.ts` |
| L'argent : un journal de mouvements, le solde est leur somme | `src/lib/solde.ts` | `solde.test.ts` |
| Réserver, annuler, scanner un ticket | `src/lib/reservation.ts` | `reservation.test.ts` |
| Le profil alimentaire | `src/lib/profil-alimentaire.ts` | `profil-alimentaire.test.ts` |
| Les recharges, les jetons et les codes | `src/lib/recharge.ts`, `src/lib/ticket.ts` | `ticket.test.ts` |
| Les bornes des plats, des menus et des notes | `src/lib/menu.ts` | `menu.test.ts` |
| Les restes pesés : kilos tapés, grammes gardés, restes par repas servi, plat le plus laissé | `src/lib/restes.ts` | `restes.test.ts` |
| Les tentatives de connexion et de code famille, comptées et limitées | `src/lib/tentatives.ts` | `tentatives.test.ts` |
| Le code famille à usage unique | `src/lib/code-famille.ts` | `code-famille.test.ts` |
| Le laissez-passer de la borne d'entrée | `src/lib/borne.ts` | `borne.test.ts` |

L'écran et le serveur appliquent la même fonction : un bouton grisé dit exactement la raison que le serveur donnerait.

## Sécurité

- Le rôle n'est jamais envoyé par le navigateur : champ fermé à la saisie, posé par le serveur.
- Chaque page vérifie la session et le rôle (`exiger`), chaque action serveur et chaque route aussi (`autorise`).
- Un parent ne voit et ne touche que ses enfants. Il ne se relie à un enfant qu'avec un code que l'enfant vient de créer
  pour lui : le code vaut 15 minutes et ne sert qu'une fois. L'enfant voit ses parents reliés et peut en retirer un.
- La connexion se ferme un moment après 8 mots de passe faux pour un même e-mail en 10 minutes (30 depuis une même
  adresse), sur le site, dans l'application et sur la route de Better Auth. Le compte vit dans la mémoire du serveur.
- Les routes de Better Auth dont la cantine ne se sert pas sont fermées (créer un compte, changer son nom ou sa photo,
  changer de mot de passe) : tout passe par les actions du site, qui valident.
- La borne d'entrée ne tourne pas sur la session de la cantine : la cantine la lance, sa session se ferme sur l'appareil,
  qui ne garde qu'un laissez-passer signé pour valider des tickets.
- Une carte de cantine perdue ou photographiée se refait : l'ancienne ne passe plus.
- Les prix et les montants sont lus dans la base par le serveur, jamais reçus du navigateur. Chaque entrée est validée (zod).
- Une réservation et son mouvement d'argent s'écrivent dans la même transaction. Le solde ne passe jamais sous zéro.
  Annuler, servir et annuler une recharge s'écrivent sous condition : deux gestes au même instant ne comptent qu'une fois.
- Le jeton d'un ticket est tiré au hasard (128 bits) ; un ticket ne se sert qu'une fois.
- Aucun secret dans le dépôt : `.env` est ignoré par git, `.env.example` ne contient aucune valeur.

## La recharge : le Mobile Money dans la page, crédité tout seul

**Paiement en ligne par Cartflox, natif** (Côte d'Ivoire seulement, en francs CFA), comme le paiement natif de LinkAfr :
pas de page de paiement hébergée ni de cadre, notre propre formulaire. On tape son numéro de Côte d'Ivoire, on choisit son
opérateur parmi ceux que le compte Cartflox ouvre (le 20/11/2026 : Wave, Orange Money et MTN MoMo), et on valide sur son
téléphone (code à usage unique pour Orange Money, l'appli pour Wave). Le compte est crédité dès que le paiement passe,
sans attendre la cantine.

- Le serveur fait tout avec la clé secrète, qui ne quitte jamais le serveur : il ouvre le paiement pour le montant de la
  recharge (lu dans la base, jamais reçu du navigateur), liste les opérateurs, déclenche le débit sur le téléphone, puis
  relit le paiement chez Cartflox. La page n'a aucune clé.
- Il ne crédite que si le paiement est passé, en francs CFA, pour au moins le montant de la recharge. Il crédite toujours
  le montant de la recharge, même si des frais ont été ajoutés au payeur.
- Une session de paiement ne sert qu'une recharge, pour toujours, et le crédit est une écriture conditionnelle : la page,
  le webhook et la cantine peuvent arriver en même temps, la recharge n'est créditée qu'une fois.
- Trois chemins mènent au crédit : la page qui relit le paiement, la page de la cantine qui relit les paiements en cours,
  et le webhook signé de Cartflox (`/api/cartflox/webhook`). Le webhook est un plus : sans lui, rien ne se perd.
- Un paiement qui ne peut pas se créditer tout seul (montant inattendu, ou arrivé après l'annulation de la demande) va dans
  « À regarder », chez la cantine, qui le crédite après l'avoir vu dans son espace Cartflox.

**Coupé pour le moment** (21/11/2026) : `PISPI_ACTIF = false` dans `src/lib/recharge.ts`, le QR n'est proposé ni sur le
site ni dans l'application mobile. Le paragraphe suivant décrit son fonctionnement quand il est rétabli.

**Le QR universel PI-SPI**, en second choix sur la même page : le QR de la BCEAO, fabriqué par sa bibliothèque officielle
[`@pi-spi/qrcode`](https://www.npmjs.com/package/@pi-spi/qrcode), avec l'adresse de paiement de la cantine, le montant et la
référence. L'argent arrive directement sur le compte de la cantine, qui confirme à la main (« Paiement reçu »). Le scanner
de Wave l'ouvre (essai du 18/11/2026 sur un vrai téléphone) ; Orange l'annonce pour Max it.

**Les espèces**, au comptoir : la cantine crédite le compte tout de suite.

### Brancher Cartflox

```bash
./scripts/cle-cartflox.sh   # demande la clé publique puis la clé secrète, sans les afficher, et les écrit dans .env.local
```

Les clés viennent de l'espace Cartflox (rubrique Développeurs). Seule la clé secrète sert ; la clé publique, si elle est
posée, doit être du même mode. Clés de production (`af_live_...`) pour de vrais paiements. Avec des clés de test
(`af_test_...`) ou un espace Cartflox encore en mode test, Cartflox ne débite jamais un téléphone : le débit direct ne
marche qu'en production. Sans clé, la recharge se règle en espèces au comptoir (le QR universel est coupé pour le
moment). Pour le webhook, déclarer
`https://<adresse>/api/cartflox/webhook` dans l'espace Cartflox : Cartflox le signe avec la clé secrète.

### Brancher l'IA (la suggestion de la semaine et l'assistant)

```bash
./scripts/cle-ia.sh   # demande la clé d'Anthropic (sk-ant-...), sans l'afficher, et l'écrit dans .env.local
```

Sans clé, le rapport de la semaine le dit et rien ne part vers l'IA. Avec elle, « Rédiger la suggestion » envoie les
chiffres du rapport, sans aucun nom d'élève, au modèle Claude Opus 5.5 (`src/lib/ia.ts`) et montre de deux à quatre
gestes pour la semaine suivante. Une réponse qui contient un chiffre n'est pas montrée (`src/lib/suggestion.ts`).

L'assistant de la cantine (le panneau à droite du tableau de bord) :
- **Les questions guidées** répondent toujours, avec les vrais chiffres et sans IA.
- **Les questions libres** passent par la même clé, avec 50 questions par jour au plus pour toute la cantine (`src/lib/assistant.ts`, `src/app/admin/assistant/actions.ts`).
- **Le compteur** vit dans le serveur et repart à zéro chaque jour.

Crédit : l'orbe de l'assistant vient de [Rare UI](https://rareui.com) (`src/components/rare-ui/`, licence dans le même
dossier), comme dans LinkAfr.

## Ce qui se fait encore à la main, dit sans détour

- **La confirmation d'une recharge réglée au comptoir** : la cantine encaisse, puis touche « Paiement reçu » (le QR
  universel, coupé pour le moment, se confirmait de la même façon). Les recharges payées par Cartflox, elles, se
  créditent toutes seules.
- **Le paiement Mobile Money n'a pas encore été vu aboutir de bout en bout** dans la base de démonstration : ses règles
  sont essayées (`cartflox.test.ts`, `mobile-money.test.ts`), un vrai débit reste à faire.
- **Les tarifs réduits** sont prévus dans la base ; aucune règle ne les applique encore, chaque repas est au prix du plat.
- **Les photos des plats** sont des images générées, à remplacer par celles de la vraie cantine.
- **Les prix et le menu** sont des données de démonstration.
- **Les alertes** s'affichent dans l'application. Pas encore de notification push ni de message WhatsApp.
- **Hors ligne** : le scanner de la cantine continue de servir d'après sa copie des tickets du jour, et l'application
  mobile garde le ticket du jour. Le reste demande le réseau, la borne d'entrée aussi.

## Préparation

Le cahier des charges (`docs/CAHIER-DES-CHARGES.md`) et le code ont été préparés à partir du 19/11/2026, avec l'accord de
l'organisation. L'historique des commits porte les vraies dates. L'interface reprend le kit de composants déjà écrit par
l'auteur pour ses autres produits (`src/components/sneat.tsx`, `fenetre.tsx`, `icons.tsx`).

## Mise en ligne

Une image Docker (`Dockerfile`) : Node 24, `next start`, la base SQLite dans le volume `/donnees`. Ces valeurs arrivent
par l'environnement du serveur : `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (l'adresse publique), `PISPI_ALIAS`
(l'adresse de paiement de la cantine), `CARTFLOX_CLE_PUBLIQUE` et `CARTFLOX_CLE_SECRETE`.

Avec de vraies données : `MODE_DEMO` coupé, et aucun compte de démonstration dans la base (leur mot de passe est écrit
plus haut). Un seul serveur : la limite des tentatives de connexion vit dans sa mémoire.
