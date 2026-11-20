# Tablée, la cantine sans file

Application de gestion de cantine, écrite pour le hackathon Vatel 2026.
En une phrase : « Plus de file, plus de gaspillage, plus d'allergie surprise, plus d'espèces. »

| Problème de la cantine | Ce que fait Tablée |
|---|---|
| Les files d'attente | On réserve à l'avance et on reçoit un ticket avec un QR. Au comptoir, un scan : servi |
| Le gaspillage | La cuisine voit le nombre exact de repas par plat avant de cuisiner |
| Les régimes et les allergies | Chaque convive a son profil alimentaire. Un plat qui ne lui convient pas ne se réserve pas |
| Les menus et les prix peu clairs | Le menu de la semaine, avec la photo, le prix et les allergènes de chaque plat |
| La gestion à la main | Commandes du jour, recharges et chiffres calculés tout seuls |

## Les trois rôles

- **L'élève ou l'employé** : voit le menu de la semaine, réserve un repas (réserver, c'est payer), annule jusqu'à 9 h le
  jour même et est remboursé tout de suite, montre son ticket au comptoir, suit son solde et son historique, règle son
  profil alimentaire, note ses repas.
- **Le parent** : relie son enfant avec un code famille, voit son solde et ses repas de la semaine (servi, non retiré),
  est prévenu quand le solde est bas, recharge le compte, règle le profil alimentaire.
- **L'administrateur de la cantine** : planifie les menus, suit les commandes d'aujourd'hui et de demain en direct, sert
  en scannant les tickets, confirme les recharges, lit son tableau de bord.

## Essayer

Adresse de la démonstration : à compléter après la mise en ligne.

Comptes de démonstration (personnes et repas inventés pour l'essai, créés par `npm run demo`) :

| Rôle | E-mail | Mot de passe |
|---|---|---|
| Élève (Awa, allergique à l'arachide) | `awa@cantine.test` | `cantine-demo-2026` |
| Parent (Mariam, sa maman) | `mariam@cantine.test` | `cantine-demo-2026` |
| Cantine (Aminata, administratrice) | `cantine@cantine.test` | `cantine-demo-2026` |

Quand `MODE_DEMO="1"`, l'accueil propose aussi « Essayer comme… » : une entrée directe dans ces trois comptes.
On peut bien sûr créer son propre compte d'élève, d'employé ou de parent. Un compte d'administrateur ne se crée jamais
par l'inscription publique.

## Lancer en local

Il faut Node 24.

```bash
npm install
cp .env.example .env        # puis mettre une valeur au hasard dans BETTER_AUTH_SECRET (openssl rand -hex 32)
npm run demo                # crée la base SQLite et les données de démonstration
npm run dev                 # http://localhost:3700
```

Vérifier : `npm test` (règles pures), `npx tsc --noEmit`, `npm run lint`.

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

### Les règles, à un seul endroit chacune

| Règle | Fichier | Essais |
|---|---|---|
| Les jours et la clôture à 9 h | `src/lib/jours.ts` | `jours.test.ts` |
| L'argent : un journal de mouvements, le solde est leur somme | `src/lib/solde.ts` | `solde.test.ts` |
| Réserver, annuler, scanner un ticket | `src/lib/reservation.ts` | `reservation.test.ts` |
| Le profil alimentaire | `src/lib/profil-alimentaire.ts` | `profil-alimentaire.test.ts` |
| Les recharges, les jetons et les codes | `src/lib/recharge.ts`, `src/lib/ticket.ts` | `ticket.test.ts` |
| Les bornes des plats, des menus et des notes | `src/lib/menu.ts` | `menu.test.ts` |

L'écran et le serveur appliquent la même fonction : un bouton grisé dit exactement la raison que le serveur donnerait.

## Sécurité

- Le rôle n'est jamais envoyé par le navigateur : champ fermé à la saisie, posé par le serveur.
- Chaque page vérifie la session et le rôle (`exiger`), chaque action serveur et chaque route aussi (`autorise`).
- Un parent ne voit et ne touche que ses enfants.
- Les prix et les montants sont lus dans la base par le serveur, jamais reçus du navigateur. Chaque entrée est validée (zod).
- Une réservation et son mouvement d'argent s'écrivent dans la même transaction. Le solde ne passe jamais sous zéro.
- Le jeton d'un ticket est tiré au hasard (128 bits) ; un ticket ne se sert qu'une fois.
- Aucun secret dans le dépôt : `.env` est ignoré par git, `.env.example` ne contient aucune valeur.

## La recharge : le Mobile Money dans la page, crédité tout seul

**Paiement en ligne par Cartflox** (Côte d'Ivoire seulement, en francs CFA). Sur la page de la recharge, le formulaire de
paiement de Cartflox (SoftPay) s'affiche à nos couleurs : on choisit Wave, Orange Money, MTN MoMo ou Moov Money, on tape son
numéro de Côte d'Ivoire et on valide sur son téléphone. Le compte est crédité dès que le paiement passe, sans attendre la
cantine.

- La page ne reçoit que la clé publique de Cartflox, qui permet seulement de créer et suivre un paiement.
- Le serveur ne croit jamais la page : il relit chaque paiement chez Cartflox avec la clé secrète, qui ne quitte jamais le
  serveur, et ne crédite que s'il est payé, en francs CFA, pour au moins le montant de la recharge. Il crédite toujours le
  montant de la recharge, même si des frais ont été ajoutés au payeur.
- Une session de paiement ne sert qu'une recharge, pour toujours, et le crédit est une écriture conditionnelle : la page,
  le webhook et la cantine peuvent arriver en même temps, la recharge n'est créditée qu'une fois.
- Trois chemins mènent au crédit : la page qui relit le paiement, la page de la cantine qui relit les paiements en cours,
  et le webhook signé de Cartflox (`/api/cartflox/webhook`). Le webhook est un plus : sans lui, rien ne se perd.
- Un paiement qui ne peut pas se créditer tout seul (montant inattendu, ou arrivé après l'annulation de la demande) va dans
  « À regarder », chez la cantine, qui le crédite après l'avoir vu dans son espace Cartflox.

**Le QR universel PI-SPI**, en second choix sur la même page : le QR de la BCEAO, fabriqué par sa bibliothèque officielle
[`@pi-spi/qrcode`](https://www.npmjs.com/package/@pi-spi/qrcode), avec l'adresse de paiement de la cantine, le montant et la
référence. L'argent arrive directement sur le compte de la cantine, qui confirme à la main (« Paiement reçu »). Le scanner
de Wave l'ouvre (essai du 18/11/2026 sur un vrai téléphone) ; Orange l'annonce pour Max it.

**Les espèces**, au comptoir : la cantine crédite le compte tout de suite.

### Brancher Cartflox

```bash
./scripts/cle-cartflox.sh   # demande la clé publique puis la clé secrète, sans les afficher, et les écrit dans .env.local
```

Les deux clés viennent de l'espace Cartflox (rubrique Développeurs) et doivent être du même mode. Clés de test
(`af_test_...`) pour essayer et pour la démo : aucun argent ne bouge, et la page le dit. Clés de production
(`af_live_...`) pour de vrais paiements. Sans clés, seul le QR universel est proposé. Pour le webhook, déclarer
`https://<adresse>/api/cartflox/webhook` dans l'espace Cartflox : Cartflox le signe avec la clé secrète.

## Ce qui se fait encore à la main, dit sans détour

- **La confirmation d'une recharge payée par le QR universel** : la cantine vérifie sur son compte que l'argent est
  arrivé, puis touche « Paiement reçu ». Les recharges payées par Cartflox, elles, se créditent toutes seules.
- **Les photos des plats** sont des images générées, à remplacer par celles de la vraie cantine.
- **Les prix et le menu** sont des données de démonstration.
- **Les alertes** s'affichent dans l'application. Pas encore de notification push ni de message WhatsApp.
- Pas de mode hors ligne.

## Préparation

Le cahier des charges (`docs/CAHIER-DES-CHARGES.md`) et le code ont été préparés à partir du 19/11/2026, avec l'accord de
l'organisation. L'historique des commits porte les vraies dates. L'interface reprend le kit de composants déjà écrit par
l'auteur pour ses autres produits (`src/components/sneat.tsx`, `fenetre.tsx`, `icons.tsx`).

## Mise en ligne

Une image Docker (`Dockerfile`) : Node 24, `next start`, la base SQLite dans le volume `/donnees`. Trois valeurs arrivent
par l'environnement du serveur : `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (l'adresse publique), `PISPI_ALIAS`
(l'adresse de paiement de la cantine), `CARTFLOX_CLE_PUBLIQUE` et `CARTFLOX_CLE_SECRETE`.
