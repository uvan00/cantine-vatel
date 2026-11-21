// Les trois files de démonstration (21/11/2026) : sans elles, la file réservation et la file classique sont vides, et
// la cuisine n'a pas d'estimation à montrer. Ce script ajoute des repas de démonstration, comme les personnes et les
// repas de `npm run demo` : à couper pour un vrai service.
//   - aujourd'hui, trois repas réservés à payer au comptoir (file réservation) ;
//   - aujourd'hui après midi, deux repas pris au badge, payés et servis au comptoir (file classique) ;
//   - les cinq derniers jours de service, quelques repas pris au badge : c'est d'eux que sort l'estimation.
// Aucun solde ne bouge : rien n'est payé avec le solde, donc aucun mouvement n'est écrit. Les repas payés en espèces ou
// par Mobile Money entrent dans l'argent de la cantine, à leur jour.
//
//   node scripts/files-demo.mts        (après `npm run demo`, ou seul)
//
// Il n'efface rien et ne double rien : un jour qui a déjà ses repas de file classique (ou, pour aujourd'hui, de file
// réservation) est laissé tel quel. Il garde toujours deux personnes sans repas aujourd'hui, pour montrer le badge.
import { PrismaClient } from "@prisma/client";
import { COMPTES_DEMO } from "../src/lib/demo.ts";
import { ajouterJours, jourIso } from "../src/lib/jours.ts";
import { lireListe } from "../src/lib/listes.ts";
import { incompatibilites } from "../src/lib/profil-alimentaire.ts";
import { fileDuRepas, SERVICES_POUR_L_ESTIMATION, type Paiement } from "../src/lib/reservation.ts";
import { nouveauCode, nouveauJeton } from "../src/lib/ticket.ts";

const prisma = new PrismaClient();
const MAINTENANT = Date.now();
const AUJOURDHUI = jourIso(MAINTENANT);
const a = (j: string, heure: number, minute = 0) => new Date(Date.parse(`${j}T00:00:00Z`) + heure * 3_600_000 + minute * 60_000);

/** Aujourd'hui : combien réservent sans payer, combien passent au badge (une fois midi passé). */
const A_PAYER_AUJOURDHUI = 3;
const AU_BADGE_AUJOURDHUI = 2;
/** Les jours de service d'avant, du plus récent au plus ancien : combien sont passés au badge. */
const AU_BADGE_AVANT = [3, 2, 4, 3, 2];
/** Ce que la caisse a choisi, à tour de rôle. */
const MOYENS: Paiement[] = ["especes", "mobile_money", "especes"];
/** Aujourd'hui, on laisse au moins ce nombre de personnes sans repas : elles servent à montrer le badge. */
const SANS_REPAS_A_GARDER = 2;

// Les personnes de la démonstration qui peuvent manger, sans celles dont la journée est mise en scène (Awa).
const reserves = new Set<string>(Object.values(COMPTES_DEMO).map((c) => c.email));
const personnes = (await prisma.profil.findMany({
  where: { plafondSemaine: null, user: { actif: true, role: "convive", email: { endsWith: "@cantine.test" } } },
  select: { userId: true, allergenes: true, regimes: true, user: { select: { name: true, email: true } } },
})).filter((p) => !reserves.has(p.user.email)).sort((x, y) => x.user.name.localeCompare(y.user.name, "fr"));

// Qui encaisse : Fatou, au comptoir ; l'admin si elle n'existe pas.
const caisse = await prisma.user.findFirst({ where: { email: { in: [COMPTES_DEMO.responsable.email, COMPTES_DEMO.admin.email] } }, orderBy: { role: "desc" }, select: { id: true } });

type Menu = { id: string; jour: string; prix: number; portions: number | null; reservees: number; plat: { allergenes: string[]; porc: boolean; vegetarien: boolean } };
async function menusDu(jour: string): Promise<Menu[]> {
  const lignes = await prisma.menuJour.findMany({
    where: { jour, epuise: false },
    orderBy: [{ prix: "desc" }, { id: "asc" }],
    include: { plat: { select: { allergenes: true, porc: true, vegetarien: true } }, _count: { select: { reservations: { where: { etat: { not: "annulee" } } } } } },
  });
  return lignes.map((m) => ({ id: m.id, jour: m.jour, prix: m.prix, portions: m.portions, reservees: m._count.reservations, plat: { allergenes: lireListe(m.plat.allergenes), porc: m.plat.porc, vegetarien: m.plat.vegetarien } }));
}

/** Ceux qui n'ont pas de repas ce jour-là, dans l'ordre des noms, en commençant plus loin d'un jour à l'autre. */
async function sansRepas(jour: string, decalage: number) {
  const pris = new Set((await prisma.reservation.findMany({ where: { jour, etat: { not: "annulee" } }, select: { conviveId: true } })).map((r) => r.conviveId));
  const libres = personnes.filter((p) => !pris.has(p.userId));
  const debut = libres.length ? decalage % libres.length : 0;
  return [...libres.slice(debut), ...libres.slice(0, debut)];
}

/** Le premier plat du jour que cette personne peut prendre : il en reste, et il va avec ce qu'elle mange. */
function platPour(p: (typeof personnes)[number], menus: Menu[], rang: number): Menu | null {
  const mange = { allergenes: lireListe(p.allergenes), regimes: lireListe(p.regimes) };
  for (let k = 0; k < menus.length; k++) {
    const m = menus[(rang + k) % menus.length];
    if (m.portions !== null && m.reservees >= m.portions) continue;
    if (incompatibilites(mange, m.plat).length === 0) return m;
  }
  return null;
}

type Geste = { paiement: Paiement; surPlace: boolean; creeLe: (rang: number) => Date; servi: boolean };
/** Ajoute jusqu'à `combien` repas ce jour-là, en gardant `aGarder` personnes sans repas. Rend le nombre ajouté. */
async function ajouter(jour: string, combien: number, decalage: number, geste: (rang: number) => Geste, aGarder = 0): Promise<number> {
  const menus = await menusDu(jour);
  const libres = await sansRepas(jour, decalage);
  let faits = 0;
  for (const p of libres) {
    if (faits >= combien || libres.length - faits <= aGarder) break;
    const m = platPour(p, menus, faits);
    if (!m) continue;
    const g = geste(faits);
    const quand = g.creeLe(faits);
    await prisma.reservation.create({
      data: {
        conviveId: p.userId, menuJourId: m.id, jour, prix: m.prix, jeton: nouveauJeton(), code: nouveauCode(),
        file: fileDuRepas({ surPlace: g.surPlace, paiement: g.paiement }), paiement: g.paiement,
        etat: g.servi ? "servie" : "reservee", creeLe: quand, serviLe: g.servi ? quand : null, serviPar: g.servi ? caisse?.id ?? null : null,
      },
    });
    m.reservees++;
    faits++;
  }
  return faits;
}

const dejaLa = async (jour: string, file: string) => (await prisma.reservation.count({ where: { jour, file, etat: { not: "annulee" } } })) > 0;
const auBadge = (quand: (rang: number) => Date) => (rang: number): Geste => ({ paiement: MOYENS[rang % MOYENS.length], surPlace: true, creeLe: quand, servi: true });

// 1. Les derniers jours de service : des repas pris au badge, vers midi et quart.
const servis = await prisma.reservation.groupBy({ by: ["jour"], where: { etat: "servie", jour: { lt: AUJOURDHUI, gte: ajouterJours(AUJOURDHUI, -60) } } });
const joursDeService = servis.map((s) => s.jour).sort().reverse().slice(0, SERVICES_POUR_L_ESTIMATION);
let avant = 0;
for (const [i, jour] of joursDeService.entries()) {
  if (await dejaLa(jour, "classique")) continue;
  avant += await ajouter(jour, AU_BADGE_AVANT[i % AU_BADGE_AVANT.length], (i + 1) * 3, auBadge((rang) => a(jour, 12, 18 + rang * 9 + i)));
}

// 2. Aujourd'hui : ceux qui ont réservé hier soir sans payer, puis, midi passé, ceux qui sont passés au badge.
let aPayer = 0;
let duJour = 0;
if (!(await dejaLa(AUJOURDHUI, "reservation"))) {
  aPayer = await ajouter(AUJOURDHUI, A_PAYER_AUJOURDHUI, 0, () => ({ paiement: "a_payer", surPlace: false, creeLe: (rang) => a(ajouterJours(AUJOURDHUI, -1), 17 + rang, 12 + rang * 7), servi: false }), SANS_REPAS_A_GARDER);
}
if (new Date(MAINTENANT).getUTCHours() >= 12 && !(await dejaLa(AUJOURDHUI, "classique"))) {
  duJour = await ajouter(AUJOURDHUI, AU_BADGE_AUJOURDHUI, 5, auBadge((rang) => new Date(MAINTENANT - (25 + rang * 20) * 60_000)), SANS_REPAS_A_GARDER);
}

console.log(`Files de démonstration : ${aPayer} repas à payer au comptoir aujourd'hui, ${duJour} pris au badge aujourd'hui, ${avant} pris au badge sur ${joursDeService.length} jours de service d'avant.`);
await prisma.$disconnect();
