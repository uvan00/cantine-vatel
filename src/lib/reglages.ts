// Les réglages de la cantine (table Reglages, une seule ligne) : l'heure de clôture des réservations, les créneaux de
// passage, les remises des tarifs. Valeurs par défaut et contrôles purs, testés par `npm test` (reglages.test.ts) ;
// la lecture en base est dans src/lib/donnees.ts (lireReglages).
import { creneauxEntre, heureValable } from "./creneaux.ts";

export type Reglages = {
  heureCloture: number;
  creneauxActifs: boolean;
  creneauDebut: string;
  creneauFin: string;
  creneauMinutes: number;
  creneauCapacite: number;
  remiseReduit: number;
  remisePersonnel: number;
};

export const REGLAGES_DEFAUT: Reglages = {
  heureCloture: 9,
  creneauxActifs: false,
  creneauDebut: "11:45",
  creneauFin: "13:45",
  creneauMinutes: 15,
  creneauCapacite: 40,
  remiseReduit: 50,
  remisePersonnel: 0,
};

/** Les heures de clôture proposées : de 6 h à midi. */
export const HEURES_CLOTURE = [6, 7, 8, 9, 10, 11, 12] as const;
export const PAS_CRENEAUX = [10, 15, 20, 30] as const;

/** La raison pour laquelle ces réglages ne s'enregistrent pas, en une phrase ; null : ils sont bons. */
export function erreurReglages(r: Reglages): string | null {
  if (!(HEURES_CLOTURE as readonly number[]).includes(r.heureCloture)) return "Une heure de clôture entre 6 h et midi";
  if (!heureValable(r.creneauDebut) || !heureValable(r.creneauFin)) return "Des heures de passage écrites comme 11:45";
  if (!(PAS_CRENEAUX as readonly number[]).includes(r.creneauMinutes)) return "Un créneau de 10, 15, 20 ou 30 minutes";
  if (creneauxEntre(r.creneauDebut, r.creneauFin, r.creneauMinutes).length === 0) return "Le service finit après son premier passage";
  if (!Number.isInteger(r.creneauCapacite) || r.creneauCapacite < 1 || r.creneauCapacite > 1000) return "Entre 1 et 1 000 passages par créneau";
  for (const remise of [r.remiseReduit, r.remisePersonnel]) {
    if (!Number.isInteger(remise) || remise < 0 || remise > 100) return "Une remise entre 0 et 100 %";
  }
  return null;
}

/** Les heures de passage du service, si la cantine les a ouvertes ; vide sinon. */
export const heuresDePassage = (r: Reglages) => (r.creneauxActifs ? creneauxEntre(r.creneauDebut, r.creneauFin, r.creneauMinutes) : []);
