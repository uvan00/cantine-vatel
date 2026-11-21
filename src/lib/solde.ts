// L'argent de la cantine se calcule ICI et nulle part ailleurs. Montants en francs CFA entiers.
// Le compte d'un convive est un journal de mouvements : le solde est leur somme, il n'est stocké nulle part.
// Fonctions pures, testées par `npm test`.

import { fcfa } from "./format.ts";

export type GenreMouvement = "recharge" | "repas" | "remboursement" | "transfert";
export type LigneJournal = { genre: GenreMouvement; montant: number };

/** Sous ce solde, le convive et son parent sont prévenus (réglable par convive). */
export const SEUIL_ALERTE_DEFAUT = 2000;
export const SEUIL_ALERTE_MAX = 50_000;

function entier(v: number) {
  if (!Number.isInteger(v) || v <= 0) throw new Error("Un montant est un nombre entier de francs, plus grand que zéro");
  return v;
}

/** Le solde : la somme du journal. */
export const soldeDe = (journal: { montant: number }[]) => journal.reduce((s, m) => s + m.montant, 0);

/** Ce que le journal reçoit pour chaque geste : un repas retire, une recharge et un remboursement ajoutent. */
export const mouvementRepas = (prix: number): LigneJournal => ({ genre: "repas", montant: -entier(prix) });
export const mouvementRemboursement = (prix: number): LigneJournal => ({ genre: "remboursement", montant: entier(prix) });
export const mouvementRecharge = (montant: number): LigneJournal => ({ genre: "recharge", montant: entier(montant) });

/** Le prix de plusieurs repas ensemble, et ce qu'il resterait du solde après eux (jamais sous zéro). */
export const totalRepas = (prix: number[]) => prix.reduce((s, p) => s + entier(p), 0);
export const resteApres = (solde: number, depense: number) => Math.max(0, solde - depense);

/** Ce qu'il manque pour payer ce prix (zéro si le solde suffit). */
export const manque = (solde: number, prix: number) => Math.max(0, prix - solde);

export const soldeBas = (solde: number, seuil: number) => solde < seuil;

/** Vrai pour un seuil d'alerte acceptable : un entier de 0 à 50 000. */
export const seuilValable = (v: number) => Number.isInteger(v) && v >= 0 && v <= SEUIL_ALERTE_MAX;

/* ── Le transfert entre frères et sœurs ─────────────────── */

/** Un parent fait passer de l'argent du compte d'un enfant à celui d'un autre : au moins 100 F CFA. */
export const TRANSFERT_MIN = 100;

/** Ce qui part du premier compte arrive, au franc près, sur le second. */
export const mouvementsTransfert = (montant: number): [LigneJournal, LigneJournal] => [
  { genre: "transfert", montant: -entier(montant) },
  { genre: "transfert", montant: entier(montant) },
];

/** Pourquoi ce transfert ne se fait pas, en une phrase ; null : il se fait. */
export function refusTransfert(t: { montant: number; soldeSource: number; memeCompte: boolean }): string | null {
  if (t.memeCompte) return "Choisis deux enfants différents";
  if (!Number.isInteger(t.montant) || t.montant < TRANSFERT_MIN) return `Au moins ${fcfa(TRANSFERT_MIN)}, sans centimes`;
  if (t.montant > t.soldeSource) return `Il n'y a que ${fcfa(Math.max(0, t.soldeSource))} sur ce compte`;
  return null;
}

/* ── Le plafond de la semaine ─────────────────────────────────────────── */

export const PLAFOND_MIN = 500;
export const PLAFOND_MAX = 200_000;

/** Un plafond : pas de plafond (null), ou un entier de 500 à 200 000 F CFA. */
export const plafondValable = (v: number | null) => v === null || (Number.isInteger(v) && v >= PLAFOND_MIN && v <= PLAFOND_MAX);

/**
 * Qui règle le plafond d'un convive : son parent quand il en a un relié (l'élève ne lève pas la limite posée par sa
 * famille), lui-même sinon (un employé, un élève sans parent dans l'application).
 */
export const peutReglerPlafond = (acteur: string, aUnParent: boolean) => acteur === "parent" || (acteur === "convive" && !aUnParent);

/** Ce repas, ajouté aux repas déjà réservés cette semaine, passerait-il au-dessus du plafond ? */
export const depassePlafond = (plafond: number | null, depenseSemaine: number, prix: number) => plafond !== null && depenseSemaine + prix > plafond;
