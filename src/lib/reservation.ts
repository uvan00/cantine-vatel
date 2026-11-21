// Les règles de la réservation, de l'annulation et du scan du ticket au comptoir. Le serveur les applique
// (src/lib/operations.ts), l'écran s'en sert pour griser un geste et dire pourquoi. Pures, testées par `npm test`.
import { fcfa, heure } from "./format.ts";
import { cloturePassee, clotureLisible, jourIso, jourProche } from "./jours.ts";
import { phraseIncompatibilites } from "./profil-alimentaire.ts";
import { depassePlafond, manque } from "./solde.ts";

export type EtatReservation = "reservee" | "servie" | "annulee";
/** Ce que l'écran montre : « non retiré » se calcule (réservé alors que son jour est passé), sans tâche planifiée. */
export type EtatAffiche = EtatReservation | "non_retiree";

export const LIBELLE_ETAT: Record<EtatAffiche, string> = {
  reservee: "Réservé",
  servie: "Servi",
  annulee: "Annulé",
  non_retiree: "Non retiré",
};

export const etatAffiche = (r: { etat: string; jour: string }, maintenant: number): EtatAffiche =>
  r.etat === "reservee" && r.jour < jourIso(maintenant) ? "non_retiree" : (r.etat as EtatReservation);

/* ── Le paiement d'un repas ─────────────────────────────────────────────────── */

/**
 * Comment un repas est payé (demande du propriétaire du 21/11/2026). `solde` : sur le solde du convive, à la
 * réservation ou au comptoir. `a_payer` : réservé sans payer, rien n'est encaissé tant que la caisse ne l'a pas dit.
 * `especes`, `mobile_money` : payé à la caisse, qui choisit le moyen ; le solde n'est pas touché.
 */
export const PAIEMENTS = ["solde", "a_payer", "especes", "mobile_money"] as const;
export type Paiement = (typeof PAIEMENTS)[number];

/** Un paiement lu en base ; inconnu ou vide (les repas d'avant), c'est le solde. */
export const lirePaiement = (v: string | null | undefined): Paiement => ((PAIEMENTS as readonly string[]).includes(v ?? "") ? (v as Paiement) : "solde");

/** Les moyens que la caisse choisit au comptoir, dans l'ordre de ses boutons. */
export const MOYENS_COMPTOIR = [
  { id: "especes", libelle: "Espèces" },
  { id: "mobile_money", libelle: "Mobile Money" },
  { id: "solde", libelle: "Son solde" },
] as const;
export type MoyenComptoir = (typeof MOYENS_COMPTOIR)[number]["id"];
export const estMoyenComptoir = (v: unknown): v is MoyenComptoir => MOYENS_COMPTOIR.some((m) => m.id === v);

/** Vrai tant que rien n'est encaissé pour ce repas. */
export const resteAPayer = (r: { paiement?: string | null }) => r.paiement === "a_payer";

/** Sous le prix, sur le ticket : comment ce repas est payé, dit au convive. */
export function paiementLisible(paiement: string | null | undefined, etat: string): string {
  const p = lirePaiement(paiement);
  if (p === "a_payer") return etat === "annulee" ? "Rien n'était payé" : etat === "servie" ? "Payé au comptoir" : etat === "non_retiree" ? "Jamais payé" : "À payer au comptoir";
  if (p === "especes") return "Payé en espèces au comptoir";
  if (p === "mobile_money") return "Payé par Mobile Money au comptoir";
  return etat === "annulee" ? "Rendu sur ton solde" : "Payé avec ton solde";
}

/** La caisse encaisse ce repas par ce moyen : le solde doit suffire quand c'est lui qui paie. */
export function peutEncaisser(moyen: MoyenComptoir, solde: number, prix: number): VerdictAnnulation {
  if (moyen === "solde" && solde < prix) return { ok: false, phrase: `Il lui manque ${fcfa(manque(solde, prix))} sur son solde` };
  return { ok: true };
}

/* ── Les trois files du comptoir ────────────────────────────────────────────── */

/**
 * Les trois files (demande du propriétaire du 21/11/2026). La file d'un repas est fixée quand il est créé et ne change
 * plus : elle dit par où il est passé, même une fois payé.
 */
export const FILES = [
  { id: "express", nom: "File express", pour: "Réservé et déjà payé" },
  { id: "reservation", nom: "File réservation", pour: "Réservé, à payer au comptoir" },
  { id: "classique", nom: "File classique", pour: "Sans réservation" },
] as const;
export type FileComptoir = (typeof FILES)[number]["id"];

/** Une file lue en base ; inconnue ou vide (les repas d'avant, tous payés à la réservation), c'est l'express. */
export const lireFile = (v: string | null | undefined): FileComptoir => (FILES.some((f) => f.id === v) ? (v as FileComptoir) : "express");
export const nomDeLaFile = (v: string | null | undefined) => FILES.find((f) => f.id === lireFile(v))?.nom ?? "File express";

/** La file d'un repas qu'on crée : pris au comptoir sans réservation, réservé sans payer, ou réservé et payé. */
export const fileDuRepas = (d: { surPlace: boolean; paiement: Paiement }): FileComptoir =>
  d.surPlace ? "classique" : d.paiement === "a_payer" ? "reservation" : "express";

/** Les jours de service qui font l'estimation : les plus récents, au plus cinq. */
export const SERVICES_POUR_L_ESTIMATION = 5;

/**
 * Combien de repas sans réservation prévoir en plus des réservations : la moyenne, arrondie au repas, de ceux des
 * derniers jours de service (du plus récent au plus ancien). Null tant qu'aucun service n'a eu lieu : rien n'est inventé.
 */
export function estimationSansReservation(parJourDeService: number[]): number | null {
  const jours = parJourDeService.slice(0, SERVICES_POUR_L_ESTIMATION);
  return jours.length === 0 ? null : Math.round(jours.reduce((s, n) => s + n, 0) / jours.length);
}

/** L'estimation en mots, pour la cuisine : « environ 6 à prévoir, d'après les 5 derniers services ». */
export function estimationLisible(estimation: number | null, services: number): string {
  if (estimation === null) return "pas encore d'estimation, elle viendra après les premiers services";
  return `environ ${estimation.toLocaleString("fr-FR")} à prévoir, d'après ${services > 1 ? `les ${services} derniers services` : "le dernier service"}`;
}

/* ── Réserver ──────────────────────────────────────────────────────────────── */

export type DemandeReservation = {
  maintenant: number;
  jour: string;
  /** Le convive a déjà un repas, non annulé, ce jour-là. */
  dejaReserve: boolean;
  epuise: boolean;
  /** Portions prévues ; null : pas de limite. */
  portions: number | null;
  /** Repas déjà réservés pour ce plat ce jour-là, annulés exclus. */
  reservees: number;
  /** Les raisons du profil alimentaire (src/lib/profil-alimentaire.ts). Vide : le plat convient. */
  incompatibilites: string[];
  solde: number;
  prix: number;
  /**
   * Vrai quand c'est la cantine qui réserve pour un convive (l'élève sans téléphone, au comptoir) : mêmes règles, clôture
   * comprise (cahier des charges, 4.1), et la phrase de refus parle du convive.
   */
  parLaCantine?: boolean;
  /**
   * Vrai seulement quand la cantine accepte une demande hors délai (peutDemanderHorsDelai) : c'est le seul chemin qui
   * réserve après la clôture, et seulement le jour même.
   */
  horsDelai?: boolean;
  /** L'heure de clôture réglée par la cantine (src/lib/reglages.ts) ; 9 h par défaut. */
  heureCloture?: number;
  /** Le plafond de la semaine posé par le parent ou le convive, et ce qui est déjà réservé cette semaine. */
  plafond?: { max: number | null; depense: number };
  /**
   * Vrai quand le repas ne se paie pas sur le solde : réservé pour payer au comptoir, ou payé à la caisse en espèces ou
   * par Mobile Money. Le solde n'est alors pas regardé ; toutes les autres règles tiennent, plafond compris.
   */
  sansSolde?: boolean;
};

export type Refus = "cloture" | "deja" | "complet" | "profil" | "plafond" | "solde";
export type Verdict = { ok: true } | { ok: false; refus: Refus; phrase: string };

/** Un plat ne se réserve plus : marqué épuisé, ou toutes ses portions sont prises. */
export const estComplet = (p: { epuise: boolean; portions: number | null; reservees: number }) =>
  p.epuise || (p.portions !== null && p.reservees >= p.portions);

/** Portions encore libres ; null : pas de limite. */
export const portionsRestantes = (p: { portions: number | null; reservees: number }) =>
  p.portions === null ? null : Math.max(0, p.portions - p.reservees);

const non = (refus: Refus, phrase: string): Verdict => ({ ok: false, refus, phrase });

/** Une réservation n'est acceptée que si tout est vrai. Sinon, la raison est dite en une phrase. */
export function peutReserver(d: DemandeReservation): Verdict {
  const cantine = d.parLaCantine === true;
  if (d.horsDelai === true ? d.jour < jourIso(d.maintenant) : cloturePassee(d.jour, d.maintenant, d.heureCloture)) {
    return non("cloture", d.horsDelai === true ? "Ce jour est passé, on ne réserve plus pour lui" : `Trop tard pour ce jour, les réservations ferment à ${clotureLisible(d.heureCloture)}`);
  }
  if (d.dejaReserve) return non("deja", cantine ? "Un repas par jour, ce convive a déjà réservé" : "Un repas par jour, tu as déjà réservé");
  if (estComplet(d)) return non("complet", "Ce plat est complet, la cuisine n'en prévoit plus");
  if (d.incompatibilites.length > 0) return non("profil", `${phraseIncompatibilites(d.incompatibilites)}, ${cantine ? "pas pour ce convive" : "pas pour toi"}`);
  if (d.plafond && depassePlafond(d.plafond.max, d.plafond.depense, d.prix)) {
    return non("plafond", `Ce repas dépasserait ${cantine ? "son" : "ton"} plafond de la semaine, ${fcfa(d.plafond.max ?? 0)}`);
  }
  if (d.sansSolde !== true && d.solde < d.prix) return non("solde", `${cantine ? "Il lui manque" : "Il te manque"} ${fcfa(manque(d.solde, d.prix))} pour ce plat`);
  return { ok: true };
}

/* ── Annuler ───────────────────────────────────────────────────────────────── */

export type VerdictAnnulation = { ok: true } | { ok: false; phrase: string };

/** On annule tant que la clôture du jour n'est pas passée : le repas est alors remboursé en entier. */
export function peutAnnuler(r: { etat: string; jour: string }, maintenant: number, heureCloture?: number): VerdictAnnulation {
  if (r.etat === "annulee") return { ok: false, phrase: "Cette réservation est déjà annulée" };
  if (r.etat === "servie") return { ok: false, phrase: "Ce repas est déjà servi" };
  if (cloturePassee(r.jour, maintenant, heureCloture)) return { ok: false, phrase: `Trop tard pour annuler, la cuisine a compté ton repas à ${clotureLisible(heureCloture)}` };
  return { ok: true };
}

/* ── La demande hors délai ──────────────────────────────────────────────────── */

export type DemandeHorsDelai = {
  maintenant: number;
  jour: string;
  heureCloture?: number;
  dejaReserve: boolean;
  /** Une demande de ce convive attend déjà la réponse de la cantine pour ce jour. */
  demandeEnCours: boolean;
  epuise: boolean;
  portions: number | null;
  reservees: number;
  incompatibilites: string[];
  /** Le plafond de la semaine du convive et ce qu'il y a déjà dépensé (annulés exclus). */
  plafond?: { max: number | null; depense: number };
  solde: number;
  prix: number;
};

/**
 * Après la clôture, le jour même, le convive sans repas demande un plat qui reste (une demande
 * urgente) : la cantine l'accepte, et c'est une réservation à son nom payée sur son solde, ou elle la refuse. Avant la
 * clôture, il réserve normalement.
 */
export function peutDemanderHorsDelai(d: DemandeHorsDelai): VerdictAnnulation {
  if (d.jour !== jourIso(d.maintenant)) return { ok: false, phrase: "On ne demande un repas hors délai que pour aujourd'hui" };
  if (!cloturePassee(d.jour, d.maintenant, d.heureCloture)) return { ok: false, phrase: "Les réservations sont encore ouvertes, réserve directement" };
  if (d.dejaReserve) return { ok: false, phrase: "Un repas par jour, tu as déjà réservé" };
  if (d.demandeEnCours) return { ok: false, phrase: "Ta demande est partie, la cantine te répond" };
  if (estComplet(d)) return { ok: false, phrase: "Ce plat est complet, la cuisine n'en prévoit plus" };
  if (d.incompatibilites.length > 0) return { ok: false, phrase: `${phraseIncompatibilites(d.incompatibilites)}, pas pour toi` };
  // Le même plafond qu'à la réservation : sinon la demande partirait pour être refusée plus tard, à l'acceptation.
  if (d.plafond && depassePlafond(d.plafond.max, d.plafond.depense, d.prix)) {
    return { ok: false, phrase: `Ce repas dépasserait ton plafond de la semaine, ${fcfa(d.plafond.max ?? 0)}` };
  }
  if (d.solde < d.prix) return { ok: false, phrase: `Il te manque ${fcfa(manque(d.solde, d.prix))} pour ce plat` };
  return { ok: true };
}

/* ── Scanner le ticket au comptoir ─────────────────────────────────────────── */

/**
 * `a_payer` : le ticket est bon mais rien n'est encaissé, la caisse choisit le moyen avant de servir.
 * `sans_repas` : un badge sans repas réservé aujourd'hui, la caisse propose les plats du jour.
 */
export type GenreScan = "servi" | "deja_servi" | "autre_jour" | "annule" | "inconnu" | "a_payer" | "sans_repas";
export type Scan = { genre: GenreScan; phrase: string };

/** « 12 h 14 » */
export const heureH = (instant: string | Date) => heure(instant).replace(":", " h ");

/** Ce que répond le comptoir pour ce ticket. Seul « servi » autorise à marquer le repas servi. */
export function scanner(r: { etat: string; jour: string; serviLe: string | Date | null; paiement?: string | null; prix?: number } | null, maintenant: number): Scan {
  if (!r) return { genre: "inconnu", phrase: "Ticket inconnu" };
  if (r.etat === "annulee") return { genre: "annule", phrase: "Ticket annulé" };
  if (r.etat === "servie") return { genre: "deja_servi", phrase: r.serviLe ? `Déjà servi à ${heureH(r.serviLe)}` : "Déjà servi" };
  const aujourdhui = jourIso(maintenant);
  if (r.jour > aujourdhui) return { genre: "autre_jour", phrase: `Ce ticket est pour ${jourProche(r.jour, maintenant)}` };
  if (r.jour < aujourdhui) return { genre: "autre_jour", phrase: `Ce ticket était pour ${jourProche(r.jour, maintenant)}` };
  // Réservé sans payer : on encaisse d'abord.
  if (resteAPayer(r)) return { genre: "a_payer", phrase: r.prix === undefined ? "À encaisser" : `À encaisser : ${fcfa(r.prix)}` };
  return { genre: "servi", phrase: "Servi" };
}
