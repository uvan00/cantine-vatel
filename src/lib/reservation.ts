// Les règles de la réservation, de l'annulation et du scan du ticket au comptoir. Le serveur les applique
// (src/lib/operations.ts), l'écran s'en sert pour griser un geste et dire pourquoi. Pures, testées par `npm test`.
import { fcfa, heure } from "./format.ts";
import { HEURE_CLOTURE_LISIBLE, cloturePassee, jourIso, jourProche } from "./jours.ts";
import { phraseIncompatibilites } from "./profil-alimentaire.ts";
import { manque } from "./solde.ts";

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
};

export type Refus = "cloture" | "deja" | "complet" | "profil" | "solde";
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
  if (cloturePassee(d.jour, d.maintenant)) return non("cloture", `Trop tard pour ce jour, les réservations ferment à ${HEURE_CLOTURE_LISIBLE}`);
  if (d.dejaReserve) return non("deja", "Un repas par jour, tu as déjà réservé");
  if (estComplet(d)) return non("complet", "Ce plat est complet, la cuisine n'en prévoit plus");
  if (d.incompatibilites.length > 0) return non("profil", `${phraseIncompatibilites(d.incompatibilites)}, pas pour toi`);
  if (d.solde < d.prix) return non("solde", `Il te manque ${fcfa(manque(d.solde, d.prix))} pour ce plat`);
  return { ok: true };
}

/* ── Annuler ───────────────────────────────────────────────────────────────── */

export type VerdictAnnulation = { ok: true } | { ok: false; phrase: string };

/** On annule tant que la clôture du jour n'est pas passée : le repas est alors remboursé en entier. */
export function peutAnnuler(r: { etat: string; jour: string }, maintenant: number): VerdictAnnulation {
  if (r.etat === "annulee") return { ok: false, phrase: "Cette réservation est déjà annulée" };
  if (r.etat === "servie") return { ok: false, phrase: "Ce repas est déjà servi" };
  if (cloturePassee(r.jour, maintenant)) return { ok: false, phrase: `Trop tard pour annuler, la cuisine a compté ton repas à ${HEURE_CLOTURE_LISIBLE}` };
  return { ok: true };
}

/* ── Scanner le ticket au comptoir ─────────────────────────────────────────── */

export type GenreScan = "servi" | "deja_servi" | "autre_jour" | "annule" | "inconnu";
export type Scan = { genre: GenreScan; phrase: string };

/** « 12 h 14 » */
export const heureH = (instant: string | Date) => heure(instant).replace(":", " h ");

/** Ce que répond le comptoir pour ce ticket. Seul « servi » autorise à marquer le repas servi. */
export function scanner(r: { etat: string; jour: string; serviLe: string | Date | null } | null, maintenant: number): Scan {
  if (!r) return { genre: "inconnu", phrase: "Ticket inconnu" };
  if (r.etat === "annulee") return { genre: "annule", phrase: "Ticket annulé" };
  if (r.etat === "servie") return { genre: "deja_servi", phrase: r.serviLe ? `Déjà servi à ${heureH(r.serviLe)}` : "Déjà servi" };
  const aujourdhui = jourIso(maintenant);
  if (r.jour > aujourdhui) return { genre: "autre_jour", phrase: `Ce ticket est pour ${jourProche(r.jour, maintenant)}` };
  if (r.jour < aujourdhui) return { genre: "autre_jour", phrase: `Ce ticket était pour ${jourProche(r.jour, maintenant)}` };
  return { genre: "servi", phrase: "Servi" };
}
