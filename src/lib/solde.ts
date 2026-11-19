// L'argent de la cantine se calcule ICI et nulle part ailleurs. Montants en francs CFA entiers.
// Le compte d'un convive est un journal de mouvements : le solde est leur somme, il n'est stocké nulle part.
// Fonctions pures, testées par `npm test`.

export type GenreMouvement = "recharge" | "repas" | "remboursement";
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

/** Ce qu'il manque pour payer ce prix (zéro si le solde suffit). */
export const manque = (solde: number, prix: number) => Math.max(0, prix - solde);

export const soldeBas = (solde: number, seuil: number) => solde < seuil;

/** Vrai pour un seuil d'alerte acceptable : un entier de 0 à 50 000. */
export const seuilValable = (v: number) => Number.isInteger(v) && v >= 0 && v <= SEUIL_ALERTE_MAX;
