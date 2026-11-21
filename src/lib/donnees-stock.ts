import "server-only";
import { prisma } from "@/lib/db";
import { besoinsDuJour, type PlatDuJour, type Unite } from "@/lib/besoins";
import { ajouterJours, jourIso, joursAPartirDe } from "@/lib/jours";
import { bonDeCommande, coutPortion, margeDe, prevision, prixUnitaire, stockDe, type CoutPortion, type LigneAchat } from "@/lib/stock";

// Les lectures de la réserve de la cuisine (lot 2 des besoins, 21/11/2026) : le stock et le prix de chaque ingrédient
// d'après ses mouvements, le bon de commande d'une période, le coût d'un repas. Les règles sont pures (src/lib/stock.ts).

/** Le stock de chaque ingrédient, son prix d'une unité (ses dernières livraisons payées) et le jour de sa dernière livraison. */
export async function stocksEtPrix(): Promise<{ stocks: Map<string, number>; prix: Map<string, number | null>; derniereLivraison: Map<string, string> }> {
  const mouvements = await prisma.mouvementStock.findMany({
    orderBy: [{ jour: "desc" }, { creeLe: "desc" }],
    select: { ingredientId: true, genre: true, quantite: true, prix: true, jour: true },
  });
  const parIngredient = new Map<string, typeof mouvements>();
  for (const m of mouvements) parIngredient.set(m.ingredientId, [...(parIngredient.get(m.ingredientId) ?? []), m]);
  const stocks = new Map<string, number>();
  const prix = new Map<string, number | null>();
  const derniereLivraison = new Map<string, string>();
  for (const [id, liste] of parIngredient) {
    const livraisons = liste.filter((m) => m.genre === "livraison");
    stocks.set(id, stockDe(liste));
    prix.set(id, prixUnitaire(livraisons));
    if (livraisons[0]) derniereLivraison.set(id, livraisons[0].jour);
  }
  return { stocks, prix, derniereLivraison };
}

/** Les ingrédients déjà sortis de la réserve pour le service de ce jour (la case « Sorti »). */
export async function sortisDuJour(jour: string): Promise<string[]> {
  const sorties = await prisma.mouvementStock.findMany({ where: { jour, genre: "sortie" }, select: { ingredientId: true } });
  return [...new Set(sorties.map((s) => s.ingredientId))];
}

/**
 * Les plats de ces jours, avec leur fiche ; `estimer` : chaque plat compte pour sa prévision (ses portions prévues,
 * sinon ses réservations), pour acheter à l'avance ; sinon pour ses réservations.
 */
async function platsDesJours(jours: string[], estimer: boolean): Promise<PlatDuJour[]> {
  const menus = await prisma.menuJour.findMany({
    where: { jour: { in: jours } },
    include: {
      plat: { select: { id: true, nom: true, recette: { include: { ingredient: true } } } },
      _count: { select: { reservations: { where: { etat: { not: "annulee" } } } } },
    },
  });
  return menus.map((m) => ({
    platId: m.plat.id,
    nom: m.plat.nom,
    reservations: estimer ? prevision({ reservations: m._count.reservations, portions: m.portions }) : m._count.reservations,
    lignes: m.plat.recette.map((l) => ({ ingredientId: l.ingredientId, nom: l.ingredient.nom, unite: l.ingredient.unite as Unite, quantite: l.quantite })),
  }));
}

/* ── La réserve ──────────────────────────────────────────────────────────── */

export type LigneReserve = {
  id: string;
  nom: string;
  unite: Unite;
  stock: number;
  /** Le prix d'une unité, en F CFA ; null tant qu'aucune livraison payée n'est notée. */
  prix: number | null;
  /** Le jour de la dernière livraison, ou null. */
  derniereLivraison: string | null;
  /** Ce que demain demande déjà (ses réservations), 0 s'il ne sert à rien demain. */
  besoinDemain: number;
};

export type MouvementAffiche = { id: string; jour: string; genre: string; quantite: number; prix: number | null; note: string; ingredient: string; unite: Unite };

export type VueReserve = { demain: string; ingredients: LigneReserve[]; mouvements: MouvementAffiche[] };

/** Chaque ingrédient connu, son stock, son prix et ce que demain en demande ; puis les derniers mouvements. */
export async function vueReserve(maintenant: number): Promise<VueReserve> {
  const demain = ajouterJours(jourIso(maintenant), 1);
  const [ingredients, { stocks, prix, derniereLivraison }, platsDemain, mouvements] = await Promise.all([
    prisma.ingredient.findMany({ orderBy: { nom: "asc" }, select: { id: true, nom: true, unite: true } }),
    stocksEtPrix(),
    platsDesJours([demain], false),
    prisma.mouvementStock.findMany({
      orderBy: [{ creeLe: "desc" }],
      take: 30,
      select: { id: true, jour: true, genre: true, quantite: true, prix: true, note: true, ingredient: { select: { nom: true, unite: true } } },
    }),
  ]);
  const besoins = new Map(besoinsDuJour(platsDemain).besoins.map((b) => [b.ingredientId, b.total]));
  return {
    demain,
    ingredients: ingredients.map((i) => ({
      id: i.id,
      nom: i.nom,
      unite: i.unite as Unite,
      stock: stocks.get(i.id) ?? 0,
      prix: prix.get(i.id) ?? null,
      derniereLivraison: derniereLivraison.get(i.id) ?? null,
      besoinDemain: besoins.get(i.id) ?? 0,
    })),
    mouvements: mouvements.map((m) => ({ id: m.id, jour: m.jour, genre: m.genre, quantite: m.quantite, prix: m.prix, note: m.note, ingredient: m.ingredient.nom, unite: m.ingredient.unite as Unite })),
  };
}

/* ── Les achats ──────────────────────────────────────────────────────────── */

export type PeriodeAchat = "demain" | "semaine";

export type VueAchats = {
  periode: PeriodeAchat;
  jours: string[];
  /** Les jours de la période qui n'ont pas encore de menu : le bon de commande ne les compte pas. */
  sansMenu: string[];
  /** Les plats de la période sans fiche recette : leurs ingrédients ne sont pas comptés. */
  sansFiche: string[];
  lignes: LigneAchat[];
  total: number;
  sansPrix: string[];
  /** Tous les ingrédients, pour noter une livraison. */
  ingredients: { id: string; nom: string; unite: Unite }[];
};

/** Le bon de commande de demain, ou des sept jours qui viennent : besoin, réserve, achat, coût estimé. */
export async function vueAchats(periode: PeriodeAchat, maintenant: number): Promise<VueAchats> {
  const demain = ajouterJours(jourIso(maintenant), 1);
  const jours = periode === "demain" ? [demain] : joursAPartirDe(demain, 7);
  const [plats, { stocks, prix }, joursAvecMenu, ingredients] = await Promise.all([
    platsDesJours(jours, true),
    stocksEtPrix(),
    prisma.menuJour.findMany({ where: { jour: { in: jours } }, distinct: ["jour"], select: { jour: true } }),
    prisma.ingredient.findMany({ orderBy: { nom: "asc" }, select: { id: true, nom: true, unite: true } }),
  ]);
  const { besoins, sansFiche } = besoinsDuJour(plats);
  const bon = bonDeCommande(besoins, stocks, prix);
  const avecMenu = new Set(joursAvecMenu.map((j) => j.jour));
  return {
    periode,
    jours,
    sansMenu: jours.filter((j) => !avecMenu.has(j)),
    sansFiche: [...new Set(sansFiche)],
    ...bon,
    ingredients: ingredients.map((i) => ({ id: i.id, nom: i.nom, unite: i.unite as Unite })),
  };
}

/* ── Le coût d'un repas ──────────────────────────────────────────────────── */

export type LigneCout = {
  platId: string;
  nom: string;
  photo: string;
  /** Le prix proposé du plat (Plat.prix), en F CFA. */
  prixVente: number;
  /** null : le plat n'a pas de fiche recette. */
  cout: CoutPortion | null;
  marge: { marge: number; part: number | null } | null;
  /** Sa fiche recette, pour la modifier d'ici. */
  lignes: { ingredientId: string; nom: string; unite: Unite; quantite: number }[];
};

export type VueCouts = { plats: LigneCout[]; ingredients: { id: string; nom: string; unite: string }[] };

/** Chaque plat de la carte : son coût matière par portion, d'après sa fiche et le prix de ses ingrédients, et sa marge. */
export async function vueCouts(): Promise<VueCouts> {
  const [plats, { prix }, ingredients] = await Promise.all([
    prisma.plat.findMany({ orderBy: { nom: "asc" }, select: { id: true, nom: true, photo: true, prix: true, recette: { include: { ingredient: { select: { nom: true, unite: true } } } } } }),
    stocksEtPrix(),
    prisma.ingredient.findMany({ orderBy: { nom: "asc" }, select: { id: true, nom: true, unite: true } }),
  ]);
  return {
    ingredients,
    plats: plats.map((p) => {
      const lignes = p.recette
        .map((l) => ({ ingredientId: l.ingredientId, nom: l.ingredient.nom, unite: l.ingredient.unite as Unite, quantite: l.quantite }))
        .sort((x, y) => x.nom.localeCompare(y.nom, "fr"));
      if (lignes.length === 0) return { platId: p.id, nom: p.nom, photo: p.photo, prixVente: p.prix, cout: null, marge: null, lignes };
      const cout = coutPortion(lignes, prix);
      return { platId: p.id, nom: p.nom, photo: p.photo, prixVente: p.prix, cout, marge: cout.complet ? margeDe(p.prix, cout.cout) : null, lignes };
    }),
  };
}
