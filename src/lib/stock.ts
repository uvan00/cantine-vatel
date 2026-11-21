// La réserve de la cuisine, les achats et le coût d'un repas (lot 2 des besoins, validé par le propriétaire le
// 21/11/2026). Le stock d'un ingrédient est la somme de ses mouvements (table MouvementStock) : plus une livraison,
// moins une sortie pour le service d'un jour, l'écart compté à l'inventaire. Le prix d'un ingrédient vient de ses
// livraisons payées, et de rien d'autre : sans elles, il est inconnu et le dit. Fonctions pures, testées par
// `npm test` (stock.test.ts).
import { quantiteLisible, type Unite } from "./besoins.ts";
import { fcfa } from "./format.ts";
import { estUnJour } from "./jours.ts";

export const GENRES_MOUVEMENT = ["livraison", "sortie", "inventaire"] as const;
export type GenreMouvement = (typeof GENRES_MOUVEMENT)[number];

/** Dix tonnes, dix mille litres ou dix millions de pièces : au-delà, c'est une faute de frappe. */
export const QUANTITE_MAX = 10_000_000;
/** Le prix d'une livraison, en F CFA, comme le montant d'une dépense. */
export const PRIX_LIVRAISON_MAX = 10_000_000;
/** Les livraisons payées qui font le prix d'un ingrédient : les plus récentes, au plus cinq. */
export const LIVRAISONS_POUR_LE_PRIX = 5;

/** Le stock : la somme des mouvements, dans l'unité de l'ingrédient (grammes, millilitres ou pièces). */
export const stockDe = (mouvements: { quantite: number }[]) => mouvements.reduce((s, m) => s + m.quantite, 0);

/**
 * Le prix d'une unité (un gramme, un millilitre, une pièce), en F CFA : le prix des dernières livraisons payées divisé
 * par leur quantité. Les livraisons arrivent de la plus récente à la plus ancienne. Null sans livraison payée.
 */
export function prixUnitaire(livraisons: { quantite: number; prix: number | null }[]): number | null {
  const payees = livraisons.filter((l) => l.prix !== null && l.quantite > 0).slice(0, LIVRAISONS_POUR_LE_PRIX);
  const quantite = payees.reduce((s, l) => s + l.quantite, 0);
  return quantite > 0 ? payees.reduce((s, l) => s + (l.prix ?? 0), 0) / quantite : null;
}

/** « 650 F CFA le kg », « 1 400 F CFA le litre », « 125 F CFA la pièce » */
export function prixLisible(parUnite: number, unite: Unite): string {
  if (unite === "g") return `${fcfa(parUnite * 1000)} le kg`;
  if (unite === "ml") return `${fcfa(parUnite * 1000)} le litre`;
  return `${fcfa(parUnite)} la pièce`;
}

/** L'unité dans laquelle on compte une livraison : les kilos pour ce qui se pèse, les litres pour ce qui se verse. */
export const UNITE_DE_SAISIE: Record<Unite, { libelle: string; facteur: number }> = {
  g: { libelle: "kg", facteur: 1000 },
  ml: { libelle: "litres", facteur: 1000 },
  piece: { libelle: "pièces", facteur: 1 },
};

/** Ce qu'on tape (« 25 », « 1,5 », « 0.75 ») dans l'unité de saisie, ramené à l'unité de l'ingrédient ; null sinon. */
export function lireQuantite(texte: string, unite: Unite): number | null {
  const t = texte.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d{1,7}(\.\d{1,3})?$/.test(t)) return null;
  const v = Math.round(Number(t) * UNITE_DE_SAISIE[unite].facteur);
  return v > 0 && v <= QUANTITE_MAX ? v : null;
}

/** Pourquoi cette livraison ne se note pas, en une phrase ; null : elle se note. */
export function refusLivraison(l: { quantite: number; prix: number | null; jour: string }, aujourdhui: string): string | null {
  if (!Number.isInteger(l.quantite) || l.quantite < 1 || l.quantite > QUANTITE_MAX) return "La quantité livrée, plus grande que zéro";
  if (l.prix !== null && (!Number.isInteger(l.prix) || l.prix < 1 || l.prix > PRIX_LIVRAISON_MAX)) return "Le prix payé, un entier en F CFA, ou rien";
  if (!estUnJour(l.jour) || l.jour > aujourdhui) return "Une livraison se note le jour où elle arrive, pas avant";
  return null;
}

/** Pourquoi ce comptage ne se note pas ; null : il se note. On compte ce qui est là, zéro compris. */
export function refusInventaire(compte: number): string | null {
  return Number.isInteger(compte) && compte >= 0 && compte <= QUANTITE_MAX ? null : "La quantité comptée, de zéro à dix tonnes";
}

/** Le libellé de la dépense notée avec une livraison payée : « Livraison : Riz, 25 kg ». */
export const libelleLivraison = (nom: string, quantite: number, unite: Unite) => `Livraison : ${nom}, ${quantiteLisible(quantite, unite)}`;

/* ── Le coût d'un repas ──────────────────────────────────────────────────── */

export type CoutPortion = {
  /** En F CFA, arrondi, sans les ingrédients dont le prix est inconnu. */
  cout: number;
  /** Vrai quand chaque ingrédient de la fiche a son prix : le coût est alors entier, pas un minimum. */
  complet: boolean;
  /** Les ingrédients sans prix connu, nommés. */
  manquants: string[];
};

/** Le coût matière d'une portion : chaque ligne de la fiche, sa quantité par portion fois le prix de son ingrédient. */
export function coutPortion(lignes: { ingredientId: string; nom: string; quantite: number }[], prix: ReadonlyMap<string, number | null>): CoutPortion {
  let cout = 0;
  const manquants: string[] = [];
  for (const l of lignes) {
    const p = prix.get(l.ingredientId) ?? null;
    if (p === null) manquants.push(l.nom);
    else cout += l.quantite * p;
  }
  return { cout: Math.round(cout), complet: lignes.length > 0 && manquants.length === 0, manquants };
}

/** Ce que laisse une portion vendue une fois la matière payée, et la part du prix qui part dans la matière. */
export function margeDe(prixVente: number, cout: number): { marge: number; part: number | null } {
  return { marge: prixVente - cout, part: prixVente > 0 ? Math.round((cout / prixVente) * 100) : null };
}

/* ── Le bon de commande ──────────────────────────────────────────────────── */

/**
 * Ce qu'un plat d'un jour à venir demandera : ses portions prévues quand la cantine en a fixé, sinon les réservations
 * déjà faites ; jamais moins que les réservations.
 */
export const prevision = (p: { reservations: number; portions: number | null }) => Math.max(p.reservations, p.portions ?? 0);

export type LigneAchat = {
  ingredientId: string;
  nom: string;
  unite: Unite;
  /** Ce que la période demande. */
  besoin: number;
  /** Ce qui est en réserve (un stock négatif compte pour zéro). */
  stock: number;
  /** Ce qu'il faut acheter : le besoin moins le stock, jamais moins que zéro. */
  aAcheter: number;
  /** Le coût de l'achat d'après le prix connu ; 0 sans rien à acheter ; null quand le prix est inconnu. */
  coutEstime: number | null;
};

/** Le bon de commande d'une période : chaque ingrédient demandé, ce qu'il faut acheter, et ce que cela coûtera. */
export function bonDeCommande(
  besoins: { ingredientId: string; nom: string; unite: Unite; total: number }[],
  stocks: ReadonlyMap<string, number>,
  prix: ReadonlyMap<string, number | null>,
): { lignes: LigneAchat[]; total: number; sansPrix: string[] } {
  const lignes = besoins.map((b): LigneAchat => {
    const stock = Math.max(0, stocks.get(b.ingredientId) ?? 0);
    const aAcheter = Math.max(0, b.total - stock);
    const p = prix.get(b.ingredientId) ?? null;
    return { ingredientId: b.ingredientId, nom: b.nom, unite: b.unite, besoin: b.total, stock, aAcheter, coutEstime: aAcheter === 0 ? 0 : p === null ? null : Math.round(aAcheter * p) };
  });
  return {
    lignes,
    total: lignes.reduce((s, l) => s + (l.coutEstime ?? 0), 0),
    sansPrix: lignes.filter((l) => l.coutEstime === null).map((l) => l.nom),
  };
}
