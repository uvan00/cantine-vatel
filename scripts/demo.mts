// Données de démonstration : `npm run demo`. Remet la base à neuf à chaque fois.
//   Une cantine FICTIVE : des personnes, des repas et des recharges inventés pour l'essai. Rien de réel.
//   Il y a toujours un service aujourd'hui et demain, quel que soit le jour où on lance la commande, plus une semaine
//   d'historique et les jours à venir (sans les dimanches).
//   Awa, élève, est allergique à l'arachide : elle a un ticket pour aujourd'hui, un repas non retiré hier, et un solde
//   de 2 000 F CFA. Mariam, sa maman, est déjà reliée à elle. Aminata tient la cantine.
//   Trois messages de la cantine et les fiches recettes des plats d'aujourd'hui et de demain, pour que les messages et
//   les besoins de la cuisine aient quelque chose à montrer.
//   Les prix sont des prix de démonstration, à remplacer par ceux de la vraie cantine.
// Les comptes et leur mot de passe sont dans src/lib/demo.ts et dans le README.
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { COMPTES_DEMO, MOT_DE_PASSE_DEMO } from "../src/lib/demo.ts";
import { ajouterJours, jourIso, jourLong } from "../src/lib/jours.ts";
import { moyenManuel, type MoyenRecharge } from "../src/lib/recharge.ts";
import { mouvementRecharge, mouvementRepas } from "../src/lib/solde.ts";
import { nouveauCode, nouveauCodeFamille, nouveauJeton, nouvelId, nouvelleReference } from "../src/lib/ticket.ts";

const prisma = new PrismaClient();

/* ── Hasard rejouable : la même graine donne les mêmes données ─────────────── */
let graine = 20261121;
const hasard = () => {
  graine = (graine + 0x6d2b79f5) | 0;
  let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const parmi = <T,>(liste: readonly T[]) => liste[Math.floor(hasard() * liste.length)];

const MAINTENANT = Date.now();
const AUJOURDHUI = jourIso(MAINTENANT);
const jour = (n: number) => ajouterJours(AUJOURDHUI, n);
/** Un instant d'un jour, à l'heure GMT (Abidjan). */
const a = (j: string, heure: number, minute = 0) => new Date(Date.parse(`${j}T00:00:00Z`) + heure * 3_600_000 + minute * 60_000);

/* ── Les plats ─────────────────────────────────────────────────────────────── */
type PlatDemo = { cle: string; nom: string; description: string; photo: string; prix: number; allergenes: string; vegetarien?: boolean };
const PLATS: PlatDemo[] = [
  { cle: "riz", nom: "Riz sauce arachide", description: "Riz blanc, sauce à la pâte d'arachide, bœuf", photo: "/plats/riz-sauce-arachide.jpg", prix: 1500, allergenes: "arachide" },
  { cle: "attieke", nom: "Attiéké poisson", description: "Semoule de manioc, poisson frit, tomate et oignon", photo: "/plats/attieke.jpg", prix: 1500, allergenes: "poisson" },
  { cle: "garba", nom: "Garba", description: "Attiéké, thon frit, piment frais", photo: "/plats/garba.jpg", prix: 1000, allergenes: "poisson" },
  { cle: "kedjenou", nom: "Kedjenou de poulet", description: "Poulet mijoté à l'étouffée, légumes, riz", photo: "/plats/kedjenou.jpg", prix: 2000, allergenes: "" },
  { cle: "poulet", nom: "Poulet braisé", description: "Poulet à la braise, attiéké", photo: "/plats/poulet-braise.jpg", prix: 2000, allergenes: "" },
  { cle: "foutou", nom: "Foutou banane sauce graine", description: "Foutou de banane plantain, sauce graine au poisson fumé", photo: "/plats/foutou-banane.jpg", prix: 1500, allergenes: "poisson" },
  { cle: "placali", nom: "Placali sauce gombo", description: "Pâte de manioc, sauce gombo, viande", photo: "/plats/placali.jpg", prix: 1500, allergenes: "" },
  { cle: "alloco", nom: "Alloco et œufs", description: "Banane plantain frite, œufs durs, piment", photo: "/plats/alloco.jpg", prix: 1000, allergenes: "oeuf", vegetarien: true },
  { cle: "igname", nom: "Igname frite aux légumes", description: "Igname frite, sauce tomate aux légumes", photo: "/plats/igname-frite.jpg", prix: 1000, allergenes: "", vegetarien: true },
  { cle: "brochettes", nom: "Brochettes de bœuf", description: "Brochettes à la braise, alloco", photo: "/plats/brochettes.jpg", prix: 2000, allergenes: "" },
];

/** Le menu d'aujourd'hui et de demain est fixé (c'est celui de la démo) ; les autres jours tournent. */
const MENU_FIXE: Record<number, { cle: string; portions?: number }[]> = {
  0: [{ cle: "attieke" }, { cle: "poulet" }, { cle: "alloco" }],
  1: [{ cle: "riz" }, { cle: "kedjenou", portions: 40 }, { cle: "igname" }],
  2: [{ cle: "garba", portions: 12 }, { cle: "foutou" }, { cle: "brochettes" }],
};
const menuDuJour = (n: number) => MENU_FIXE[n] ?? [0, 1, 2].map((k) => ({ cle: PLATS[(((n + 20) * 3 + k * 4) % PLATS.length + PLATS.length) % PLATS.length].cle }))
  .filter((p, i, tous) => tous.findIndex((q) => q.cle === p.cle) === i);
const estDimanche = (j: string) => new Date(`${j}T12:00:00Z`).getUTCDay() === 0;
/** Les jours servis : de six jours avant à six jours après, sans les dimanches, mais toujours aujourd'hui et demain. */
const JOURS_SERVIS = Array.from({ length: 13 }, (_, i) => i - 6).filter((n) => n === 0 || n === 1 || !estDimanche(jour(n)));

/* ── Les personnes ─────────────────────────────────────────────────────────── */
const PRENOMS = ["Fatou", "Moussa", "Adjoua", "Ibrahim", "Marie", "Serge", "Aïcha", "Yves", "Salimata", "Didier", "Affoué", "Koffi", "Mariam", "Jean", "Awa", "Stéphane", "Rokia", "Arnaud", "Bintou", "Cédric", "Nadia", "Hervé", "Kadiatou", "Patrick", "Estelle", "Souleymane"];
const NOMS = ["Diabaté", "Traoré", "Kouamé", "Coulibaly", "N'Guessan", "Aka", "Ouattara", "Konan", "Bakayoko", "Gnagne", "Yao", "Koné", "Touré", "Brou", "Soro", "Kouassi", "Diallo", "Assi"];
const CLASSES = ["Bachelor 1", "Bachelor 2", "Bachelor 3", "MBA 1", "MBA 2"];
const SERVICES = ["Accueil", "Administration", "Cuisine pédagogique", "Entretien"];
const sansAccent = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z]/g, "").toLowerCase();

type Personne = { id: string; nom: string; email: string; role: "convive" | "parent" | "admin"; genre?: "eleve" | "employe"; classe?: string; allergenes?: string; regimes?: string; seuil?: number; image?: string };

/* Les avatars dessinés (public/avatars) : chaque personne de la démonstration a le sien, d'après son prénom (la liste
   des prénoms alterne fille et garçon) ; une sur quatre garde ses initiales, comme quelqu'un qui n'a pas encore choisi.
   Rien n'est tiré au hasard ici : le reste de la démonstration ne bouge pas. */
const avatar = (n: string) => `/avatars/${n}.webp`;
const AVATARS_ELEVES = { fille: ["03", "05", "07", "09", "11"], garcon: ["04", "06", "08", "10", "12"] };
const AVATARS_ADULTES = { fille: ["13", "15"], garcon: ["14", "16"] };
function avatarDe(p: Personne, rang: number): string | undefined {
  if (rang % 4 === 3) return undefined;
  const fille = PRENOMS.indexOf(p.nom.split(" ")[0]) % 2 === 0;
  const liste = p.genre === "employe" ? AVATARS_ADULTES : AVATARS_ELEVES;
  const parmiEux = fille ? liste.fille : liste.garcon;
  return avatar(parmiEux[rang % parmiEux.length]);
}

async function main() {
  // Tout repart de zéro, dans l'ordre des liens.
  await prisma.messageLu.deleteMany();
  await prisma.message.deleteMany();
  await prisma.favori.deleteMany();
  await prisma.demandeRepas.deleteMany();
  await prisma.ligneRecette.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.note.deleteMany();
  await prisma.mouvement.deleteMany();
  await prisma.paiementCartflox.deleteMany();
  await prisma.recharge.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.menuJour.deleteMany();
  await prisma.plat.deleteMany();
  await prisma.lienParent.deleteMany();
  await prisma.profil.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.user.deleteMany();

  /* Les comptes : même mot de passe de démonstration pour tous, haché une fois comme le fait Better Auth. */
  const motDePasse = await hashPassword(MOT_DE_PASSE_DEMO);
  const admin: Personne = { id: nouvelId("u_"), nom: COMPTES_DEMO.admin.nom, email: COMPTES_DEMO.admin.email, role: "admin", image: avatar("15") };
  const awa: Personne = { id: nouvelId("u_"), nom: COMPTES_DEMO.convive.nom, email: COMPTES_DEMO.convive.email, role: "convive", genre: "eleve", classe: "Bachelor 2", allergenes: "arachide", image: avatar("01") };
  const ismael: Personne = { id: nouvelId("u_"), nom: "Ismaël Koné", email: "ismael@cantine.test", role: "convive", genre: "eleve", classe: "Bachelor 1", image: avatar("02") };
  const kouassi: Personne = { id: nouvelId("u_"), nom: "Kouassi Yao", email: "kouassi@cantine.test", role: "convive", genre: "employe", classe: "Accueil", regimes: "sans-porc", image: avatar("16") };
  const mariam: Personne = { id: nouvelId("u_"), nom: COMPTES_DEMO.parent.nom, email: COMPTES_DEMO.parent.email, role: "parent", image: avatar("13") };

  const autres: Personne[] = [];
  const pris = new Set([admin, awa, ismael, kouassi, mariam].map((p) => p.email));
  while (autres.length < 34) {
    const prenom = parmi(PRENOMS), nom = parmi(NOMS);
    const email = `${sansAccent(prenom)}.${sansAccent(nom)}@cantine.test`;
    if (pris.has(email)) continue;
    pris.add(email);
    const employe = hasard() < 0.25;
    autres.push({ id: nouvelId("u_"), nom: `${prenom} ${nom}`, email, role: "convive", genre: employe ? "employe" : "eleve", classe: employe ? parmi(SERVICES) : parmi(CLASSES), regimes: hasard() < 0.08 ? "vegetarien" : "" });
  }

  autres.forEach((p, rang) => { p.image = avatarDe(p, rang); });

  const tous = [admin, awa, ismael, kouassi, mariam, ...autres];
  const creation = a(jour(-20), 8);
  for (const p of tous) {
    await prisma.user.create({ data: { id: p.id, name: p.nom, email: p.email, emailVerified: true, role: p.role, image: p.image ?? null, createdAt: creation, updatedAt: creation } });
    await prisma.account.create({ data: { id: nouvelId("a_"), accountId: p.id, providerId: "credential", userId: p.id, password: motDePasse, createdAt: creation, updatedAt: creation } });
    if (p.role === "convive") {
      await prisma.profil.create({ data: { userId: p.id, genre: p.genre ?? "eleve", classe: p.classe ?? "", allergenes: p.allergenes ?? "", regimes: p.regimes ?? "", codeFamille: nouveauCodeFamille(), seuilAlerte: p.seuil ?? 2000 } });
    }
  }
  await prisma.lienParent.create({ data: { parentId: mariam.id, enfantId: awa.id } });
  await prisma.lienParent.create({ data: { parentId: mariam.id, enfantId: ismael.id } });

  /* Les plats et le menu de chaque jour servi. */
  const plats = new Map<string, { id: string; nom: string; prix: number; vegetarien: boolean }>();
  for (const p of PLATS) {
    const cree = await prisma.plat.create({ data: { nom: p.nom, description: p.description, photo: p.photo, prix: p.prix, allergenes: p.allergenes, vegetarien: p.vegetarien ?? false, creeLe: creation } });
    plats.set(p.cle, { id: cree.id, nom: p.nom, prix: p.prix, vegetarien: p.vegetarien ?? false });
  }
  type Menu = { id: string; jour: string; cle: string; nom: string; prix: number; portions: number | null; reservees: number; vegetarien: boolean };
  const menus = new Map<number, Menu[]>();
  for (const n of JOURS_SERVIS) {
    const duJour: Menu[] = [];
    for (const m of menuDuJour(n)) {
      const p = plats.get(m.cle)!;
      const cree = await prisma.menuJour.create({ data: { jour: jour(n), platId: p.id, prix: p.prix, portions: m.portions ?? null } });
      duJour.push({ id: cree.id, jour: jour(n), cle: m.cle, nom: p.nom, prix: p.prix, portions: m.portions ?? null, reservees: 0, vegetarien: p.vegetarien });
    }
    menus.set(n, duJour);
  }

  /* Réserver : la réservation et son mouvement, comme le fait l'application. */
  const depenses = new Map<string, number>();
  let servis = 0, nonRetires = 0, notes = 0;
  async function reserver(p: Personne, n: number, m: Menu, etat: "reservee" | "servie", quand: Date, serviLe: Date | null = null, note: number | null = null) {
    const r = await prisma.reservation.create({ data: { conviveId: p.id, menuJourId: m.id, jour: m.jour, prix: m.prix, etat, jeton: nouveauJeton(), code: nouveauCode(), creeLe: quand, serviLe } });
    const mv = mouvementRepas(m.prix);
    await prisma.mouvement.create({ data: { conviveId: p.id, genre: mv.genre, montant: mv.montant, libelle: `Repas du ${jourLong(m.jour)} : ${m.nom}`, reservationId: r.id, creeLe: quand } });
    depenses.set(p.id, (depenses.get(p.id) ?? 0) + m.prix);
    m.reservees++;
    if (etat === "servie") servis++;
    if (etat === "reservee" && n < 0) nonRetires++;
    if (note) { await prisma.note.create({ data: { reservationId: r.id, platId: plats.get(m.cle)!.id, conviveId: p.id, note, creeLe: serviLe ?? quand } }); notes++; }
    return r;
  }
  // Une recharge confirmée par la cantine : en espèces au comptoir tant que le QR universel est coupé (moyenManuel).
  async function recharger(p: Personne, montant: number, quand: Date, moyen: MoyenRecharge = moyenManuel(), demandeur: Personne = p) {
    const reference = nouvelleReference();
    const r = await prisma.recharge.create({ data: { beneficiaireId: p.id, demandeurId: demandeur.id, montant, reference, moyen, etat: "confirmee", confirmeePar: admin.id, creeLe: quand, confirmeeLe: quand } });
    const mv = mouvementRecharge(montant);
    await prisma.mouvement.create({ data: { conviveId: p.id, genre: mv.genre, montant: mv.montant, libelle: moyen === "especes" ? `Recharge en espèces ${reference}` : `Recharge ${reference}`, rechargeId: r.id, creeLe: quand } });
  }

  const heureDuJour = new Date(MAINTENANT).getUTCHours();
  const convient = (p: Personne, m: Menu) => !(p.regimes === "vegetarien" && !m.vegetarien) && (m.portions === null || m.reservees < m.portions);

  // Les autres convives : une semaine de repas, aujourd'hui, demain, et un plat complet après-demain.
  for (const p of [ismael, kouassi, ...autres]) {
    for (const n of JOURS_SERVIS) {
      const proba = n < 0 ? 0.72 : n === 0 ? 0.8 : n === 1 ? 0.55 : n === 2 ? 0.45 : 0.12;
      if (hasard() > proba) continue;
      const choix = (menus.get(n) ?? []).filter((m) => convient(p, m));
      if (choix.length === 0) continue;
      const m = parmi(choix);
      const quand = a(jour(n < 0 ? n - 1 : -1), 14 + Math.floor(hasard() * 6), Math.floor(hasard() * 60));
      if (n < 0) {
        const retire = hasard() > 0.07;
        const serviLe = retire ? a(jour(n), 12, Math.floor(hasard() * 80)) : null;
        await reserver(p, n, m, retire ? "servie" : "reservee", quand, serviLe, retire && hasard() < 0.6 ? parmi([3, 4, 4, 4, 5, 5, 5]) : null);
      } else if (n === 0 && heureDuJour >= 12 && hasard() < 0.4) {
        await reserver(p, n, m, "servie", quand, new Date(MAINTENANT - Math.floor(hasard() * 50 + 5) * 60_000));
      } else {
        await reserver(p, n, m, "reservee", quand);
      }
    }
  }
  // Après-demain, le garba affiche complet : ses douze portions sont prises.
  const garba = (menus.get(2) ?? []).find((m) => m.cle === "garba");
  if (garba) {
    const dejaLa = new Set((await prisma.reservation.findMany({ where: { jour: jour(2) }, select: { conviveId: true } })).map((r) => r.conviveId));
    for (const p of autres) {
      if (garba.reservees >= (garba.portions ?? 0)) break;
      if (dejaLa.has(p.id) || p.regimes === "vegetarien") continue;
      await reserver(p, 2, garba, "reservee", a(jour(-1), 16, Math.floor(hasard() * 60)));
    }
  }
  // Chacun a rechargé assez pour ses repas, avec un reste.
  for (const p of [ismael, kouassi, ...autres]) {
    const total = (depenses.get(p.id) ?? 0) + parmi([1500, 2500, 3000, 4500, 6000]);
    const premiere = Math.max(1000, Math.ceil((total * 0.6) / 500) * 500);
    await recharger(p, premiere, a(jour(-8), 9 + Math.floor(hasard() * 6)), hasard() < 0.3 ? "especes" : moyenManuel());
    if (total - premiere >= 500) await recharger(p, Math.ceil((total - premiere) / 500) * 500, a(jour(-3), 10 + Math.floor(hasard() * 5)), moyenManuel());
  }

  // Awa : deux repas servis et notés, un repas non retiré, un ticket pour aujourd'hui. Sa maman a rechargé de quoi lui
  // laisser 2 000 F CFA tout rond : assez pour réserver demain, puis passer sous son seuil d'alerte.
  const duJour = (n: number, cle: string) => (menus.get(n) ?? []).find((m) => m.cle === cle);
  const prix = (n: number, vise: number) => (menus.get(n) ?? []).filter((m) => m.cle !== "riz").sort((x, y) => Math.abs(x.prix - vise) - Math.abs(y.prix - vise))[0];
  const passes = JOURS_SERVIS.filter((n) => n < 0).slice(-3);
  const vises = [1500, 1000, 1500];
  let repasAwa = 0;
  for (let i = 0; i < passes.length; i++) {
    const n = passes[i], m = prix(n, vises[i]);
    if (!m) continue;
    const dernier = i === passes.length - 1;
    await reserver(awa, n, m, dernier ? "reservee" : "servie", a(jour(n - 1), 17, 12), dernier ? null : a(jour(n), 12, 14 + i * 7), dernier ? null : i === 0 ? 5 : 4);
    repasAwa += m.prix;
  }
  const aujourdhuiAwa = duJour(0, "attieke")!;
  await reserver(awa, 0, aujourdhuiAwa, "reservee", a(jour(-1), 18, 30));
  repasAwa += aujourdhuiAwa.prix;
  await recharger(awa, 6000, a(jour(-7), 18, 5), moyenManuel(), mariam);
  const seconde = repasAwa + 2000 - 6000;
  if (seconde > 0) await recharger(awa, seconde, a(jour(-2), 19, 40), moyenManuel(), mariam);

  // Deux recharges attendent la cantine, pour que sa page ne soit pas vide.
  await prisma.recharge.create({ data: { beneficiaireId: kouassi.id, demandeurId: kouassi.id, montant: 5000, reference: nouvelleReference(), moyen: moyenManuel(), etat: "en_attente", creeLe: new Date(MAINTENANT - 25 * 60_000) } });
  await prisma.recharge.create({ data: { beneficiaireId: ismael.id, demandeurId: mariam.id, montant: 10_000, reference: nouvelleReference(), moyen: moyenManuel(), etat: "en_attente", creeLe: new Date(MAINTENANT - 8 * 60_000) } });

  // Trois messages de la cantine, pour que la page des messages ne soit pas vide : un épinglé pour tous, un pour les
  // convives, un pour les parents.
  const MESSAGES = [
    { titre: "Bienvenue à la cantine sans file", texte: "Réserve ton repas avant la clôture, montre ton ticket au comptoir, et c'est servi", cible: "tous", epingle: true, quand: a(jour(-6), 8) },
    { titre: "Dis-nous ce que tu en as pensé", texte: "Une fois servi, note ton repas depuis ton ticket : la cuisine lit toutes les notes", cible: "convives", epingle: false, quand: a(jour(-2), 15, 30) },
    { titre: "Suis le compte de ton enfant", texte: "Ton enfant crée un code dans son compte, sous « Relier un parent » : saisis-le dans ton espace, tu verras son solde et ses repas", cible: "parents", epingle: false, quand: a(jour(-1), 9, 15) },
  ];
  for (const m of MESSAGES) await prisma.message.create({ data: { titre: m.titre, texte: m.texte, cible: m.cible, epingle: m.epingle, auteurId: admin.id, creeLe: m.quand } });

  // Les fiches recettes des plats d'aujourd'hui et de demain (quantités de démonstration, pour une portion), pour que
  // les besoins de la cuisine aient un calcul à montrer. À remplacer par les fiches de la vraie cantine.
  const FICHES: Record<string, [string, "g" | "ml" | "piece", number][]> = {
    attieke: [["Attiéké", "g", 250], ["Poisson", "g", 180], ["Tomate", "g", 60], ["Oignon", "g", 30], ["Huile", "ml", 20]],
    poulet: [["Poulet", "g", 250], ["Attiéké", "g", 200], ["Oignon", "g", 30], ["Huile", "ml", 15]],
    alloco: [["Banane plantain", "piece", 2], ["Œuf", "piece", 2], ["Huile", "ml", 40]],
    riz: [["Riz", "g", 150], ["Pâte d'arachide", "g", 60], ["Bœuf", "g", 120], ["Tomate", "g", 40], ["Oignon", "g", 30]],
    kedjenou: [["Poulet", "g", 250], ["Tomate", "g", 80], ["Oignon", "g", 40], ["Riz", "g", 150]],
    igname: [["Igname", "g", 300], ["Tomate", "g", 80], ["Oignon", "g", 30], ["Huile", "ml", 30]],
  };
  const ingredients = new Map<string, string>();
  let lignesDeFiche = 0;
  for (const [cle, lignes] of Object.entries(FICHES)) {
    const plat = plats.get(cle);
    if (!plat) continue;
    for (const [nom, unite, quantite] of lignes) {
      if (!ingredients.has(nom)) ingredients.set(nom, (await prisma.ingredient.create({ data: { nom, unite } })).id);
      await prisma.ligneRecette.create({ data: { platId: plat.id, ingredientId: ingredients.get(nom)!, quantite } });
      lignesDeFiche++;
    }
  }

  // Les restes pesés après chaque service passé, pour que le tableau de bord ait un bilan à montrer : des grammes par repas
  // servi propres à chaque plat, qui varient d'un jour à l'autre. Sans tirage au hasard : le reste de la démonstration ne
  // bouge pas. Aujourd'hui n'est pas pesé : c'est à la cantine de le faire, sur la page des commandes.
  const RESTES_PAR_REPAS: Record<string, number> = { riz: 90, attieke: 60, garba: 40, kedjenou: 70, poulet: 30, foutou: 110, placali: 130, alloco: 35, igname: 55, brochettes: 25 };
  const servisParMenu = new Map((await prisma.reservation.groupBy({ by: ["menuJourId"], where: { etat: "servie", jour: { lt: jour(0) } }, _count: { _all: true } })).map((g) => [g.menuJourId, g._count._all]));
  let pesees = 0;
  for (const n of JOURS_SERVIS.filter((j) => j < 0)) {
    for (const [i, m] of (menus.get(n) ?? []).entries()) {
      const servisDuPlat = servisParMenu.get(m.id) ?? 0;
      if (servisDuPlat === 0) continue;
      const parRepas = (RESTES_PAR_REPAS[m.cle] ?? 60) + ((n * 7 + i * 13) % 30);
      await prisma.menuJour.update({ where: { id: m.id }, data: { restes: Math.round((servisDuPlat * parRepas) / 50) * 50 } });
      pesees++;
    }
  }

  const soldeAwa = (await prisma.mouvement.aggregate({ where: { conviveId: awa.id }, _sum: { montant: true } }))._sum.montant ?? 0;
  const negatifs = (await prisma.mouvement.groupBy({ by: ["conviveId"], _sum: { montant: true } })).filter((s) => (s._sum.montant ?? 0) < 0).length;
  console.log(`Cantine de démonstration prête : ${tous.length} comptes, ${PLATS.length} plats, ${JOURS_SERVIS.length} jours servis.`);
  console.log(`Repas servis : ${servis}, non retirés : ${nonRetires}, notes : ${notes}, plats pesés : ${pesees}. Solde d'Awa : ${soldeAwa} F CFA. Comptes sous zéro : ${negatifs}.`);
  console.log(`Messages : ${MESSAGES.length}, fiches recettes : ${Object.keys(FICHES).length} plats, ${ingredients.size} ingrédients, ${lignesDeFiche} lignes.`);
  console.log(`Comptes de démonstration : ${COMPTES_DEMO.convive.email} (élève), ${COMPTES_DEMO.parent.email} (parent), ${COMPTES_DEMO.admin.email} (cantine). Mot de passe : voir le README.`);
  if (negatifs > 0 || soldeAwa !== 2000) process.exitCode = 1;
}

main().finally(() => prisma.$disconnect());
