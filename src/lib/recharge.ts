// Les règles de la recharge d'un compte. L'argent va directement sur le compte de la cantine (QR universel PI-SPI ou
// espèces au comptoir) : l'application ne le touche jamais, elle note seulement ce que la cantine confirme.
// Pures, testées par `npm test`.

export type EtatRecharge = "en_attente" | "confirmee" | "annulee";
export type MoyenRecharge = "cartflox" | "pispi" | "especes";

export const MONTANTS_RAPIDES = [2000, 5000, 10_000] as const;
export const RECHARGE_MIN = 500;
export const RECHARGE_MAX = 100_000;

/** Un montant de recharge : un entier de francs entre 500 et 100 000. */
export const montantValable = (v: number) => Number.isInteger(v) && v >= RECHARGE_MIN && v <= RECHARGE_MAX;

export const LIBELLE_ETAT_RECHARGE: Record<EtatRecharge, string> = {
  en_attente: "En attente de la cantine",
  confirmee: "Reçue",
  annulee: "Annulée",
};

export const LIBELLE_MOYEN: Record<MoyenRecharge, string> = {
  cartflox: "Mobile Money (Cartflox)",
  pispi: "QR universel",
  especes: "Espèces au comptoir",
};

/** Une même personne ne laisse pas plus de trois demandes en attente : la liste de la cantine reste lisible. */
export const ATTENTES_MAX = 3;
export const peutDemander = (enAttente: number) => enAttente < ATTENTES_MAX;

/** Seule une demande en attente se confirme ou s'annule. */
export const peutConfirmer = (r: { etat: string }) => r.etat === "en_attente";
export const peutAnnulerRecharge = (r: { etat: string }) => r.etat === "en_attente";
