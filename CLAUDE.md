# Tablée, la cantine sans file (hackathon Vatel)

Lire d'abord `docs/CAHIER-DES-CHARGES.md` (tous les choix) puis `README.md` (architecture, commandes).
Harness du propriétaire : `~/.agents/harness/AGENTS.md`, puis la fiche `~/.agents/harness/produits/cantine.md`.

## Règles du projet

- Tout le texte visible en français, en « tu », ton chaleureux et un peu taquin. Aucun tiret long, tiret moyen ni point
  médian dans ce qui se voit ; guillemets « » ; pas de point d'exclamation ; pas de point à la fin d'un libellé court ;
  montants par `fcfa()` de `src/lib/format.ts` (entiers, pas de centimes).
- Aucun chiffre inventé à l'écran ni dans le pitch : il vient de la base ou d'une source citée.
- L'argent se calcule à UN endroit : `src/lib/solde.ts` (pur, testé par `npm test`). Tout ce qui écrit dans la base passe
  par `src/lib/operations.ts`, dans une transaction. Le serveur décide des montants, l'écran affiche. Un essai pour toute
  règle nouvelle.
- Sécurité : chaque page appelle `exiger(...)`, chaque action serveur et chaque route JSON appelle `autorise(...)`
  (`src/lib/session.ts`). Le rôle n'est jamais reçu du navigateur. Un parent ne voit que ses enfants (`peutAgirPour` de
  `src/lib/donnees.ts`). Chaque action valide son entrée avec zod.
- Interface : le kit du tableau de bord de LinkAfr, recopié TEL QUEL dans `src/components/sneat.tsx`, `fenetre.tsx`
  (fenêtre, tiroir, en-tête de page) et `icons.tsx` (Hugeicons) : ne pas les retoucher. Jetons `--h-*` et `--sn-*` dans
  `globals.css`. Un seul thème, clair. Le vert de Tablée (#1F7A4A, #185A33 pour écrire) reste rare : la sélection, le
  chiffre qui compte, le tampon. Bouton principal à l'encre (`SBtn tone="secondary"` ou `hb hb--encre`). Police DM Sans ;
  IBM Plex Mono pour le ticket seulement.
- Direction validée par le propriétaire le 19/11/2026 (cahier des charges, section 9) : chaleureux, taquin, net ; le self
  à midi ; les deux moments riches sont le ticket repas et les photos des plats ; la signature est le tampon « SERVI ».
- Pas d'icône « magie IA », pas de dégradé de couleur, pas d'emoji.
- Recharge (choix du propriétaire du 20/11/2026) : Cartflox en paiement NATIF, comme LinkAfr (`paiement-natif.tsx` de
  LinkAfr est le modèle) : notre formulaire, Côte d'Ivoire seulement, en francs CFA. Le serveur ouvre le paiement, liste les
  opérateurs, débite le téléphone et relit le paiement avec la clé secrète avant de créditer, une seule fois par recharge
  (`src/lib/cartflox.ts` et `src/lib/mobile-money.ts`, purs et testés ; `src/lib/cartflox-serveur.ts`). La page n'a aucune clé. Le QR
  universel PI-SPI (`src/lib/pispi.ts`) reste en second choix, confirmé à la main par la cantine (« Paiement reçu »).
  Les clés se posent avec `./scripts/cle-cartflox.sh` (jamais dans le code, jamais dans git, jamais copiées par un agent ;
  clés de test pour la démo).
- Rien en ligne sans le mot « déploie » du propriétaire. Jamais un secret affiché, copié ni commité.

## Où est quoi

- `src/lib/*.ts` : les règles pures et leurs essais à côté (`jours`, `solde`, `reservation`, `profil-alimentaire`, `listes`,
  `recharge`, `menu`, `ticket`, `format`). `src/lib/operations.ts` : tout ce qui écrit. `src/lib/donnees.ts` : les
  lectures partagées. `src/lib/session.ts` : qui est connecté. `src/lib/horloge.ts` : l'heure qu'il est, pour les pages.
- `src/app/(auth)` : connexion, inscription. `src/app/(espace)` : le convive et le parent (coque à onglets en bas).
  `src/app/admin` : la cantine (coque à rail). `src/app/api` : les routes relues « en direct » (toutes les 3 secondes).
- `scripts/demo.mts` : les données de démonstration. `scripts/session.mjs` et `scripts/capture.mjs` : les captures.

## Vérifier

- `npm test`, `npx tsc --noEmit`, `./node_modules/.bin/eslint src scripts`.
- Serveur de développement : port 3700. `npm run demo` remet la base de démonstration à neuf.
- Captures : `COOKIE="$(node scripts/session.mjs awa@cantine.test)" MOBILE=1 node scripts/capture.mjs http://localhost:3700/menu captures/menu.png`
  (`LARGEUR`, `HAUTEUR`, `PLEINE=0`, `ACTION="code JS"`, `PORT_CDP`).
