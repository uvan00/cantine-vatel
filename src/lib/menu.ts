// Les bornes d'un plat et d'un menu du jour, vérifiées par le serveur avant d'écrire. Pures, testées par `npm test`.

export const PRIX_MIN = 100;
export const PRIX_MAX = 50_000;
export const PORTIONS_MAX = 5000;
export const NOM_MAX = 60;
export const DESCRIPTION_MAX = 160;

/** Un prix : un entier de francs entre 100 et 50 000. */
export const prixValable = (v: number) => Number.isInteger(v) && v >= PRIX_MIN && v <= PRIX_MAX;

/** Des portions prévues : null (pas de limite) ou un entier de 1 à 5 000. */
export const portionsValables = (v: number | null) => v === null || (Number.isInteger(v) && v >= 1 && v <= PORTIONS_MAX);

/**
 * Un plat ne se retire du menu d'un jour que s'il n'a jamais été réservé (une réservation annulée compte : le journal
 * garde sa trace). Sinon, on le marque épuisé.
 */
export const peutRetirer = (reservations: number) => reservations === 0;

/** Une note : un entier de 1 à 5. */
export const noteValable = (v: number) => Number.isInteger(v) && v >= 1 && v <= 5;

/** La moyenne d'une liste de notes, arrondie au dixième ; null sans note. */
export const moyenne = (notes: number[]) => (notes.length === 0 ? null : Math.round((notes.reduce((s, n) => s + n, 0) / notes.length) * 10) / 10);
