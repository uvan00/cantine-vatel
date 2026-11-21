// Les messages de la cantine aux familles (messages épinglés, accusés de lecture, et
// alertes ciblées : tout le monde, ou ceux qui ont commandé récemment). Règles pures, testées par `npm test`.

import { estCantine, type Role } from "./roles.ts";

export const CIBLES = ["tous", "convives", "parents", "semaine"] as const;
export type Cible = (typeof CIBLES)[number];

export const LIBELLE_CIBLE: Record<Cible, string> = {
  tous: "Tout le monde",
  convives: "Les élèves et le personnel",
  parents: "Les parents",
  semaine: "Ceux qui ont réservé cette semaine, et leurs parents",
};

export const TITRE_MAX = 80;
export const TEXTE_MAX = 1000;

/** Pourquoi ce message ne part pas, en une phrase ; null : il part. */
export function refusMessage(m: { titre: string; texte: string; cible: string }): string | null {
  const titre = m.titre.trim(), texte = m.texte.trim();
  if (!titre) return "Donne un titre à ton message";
  if (titre.length > TITRE_MAX) return `Un titre de ${TITRE_MAX} caractères au plus`;
  if (!texte) return "Écris ton message";
  if (texte.length > TEXTE_MAX) return `Un message de ${TEXTE_MAX} caractères au plus`;
  if (!(CIBLES as readonly string[]).includes(m.cible)) return "Choisis à qui il s'adresse";
  return null;
}

/**
 * Ce message est-il pour cette personne ? Un convive, d'après son rôle et ses réservations de la semaine ; un parent,
 * d'après son rôle et les réservations de la semaine de ses enfants.
 */
export function pourQui(cible: string, p: { role: Role; reserveCetteSemaine: boolean }): boolean {
  // Les gens de la cantine (admin, responsable) écrivent les messages, ils n'en reçoivent pas.
  if (estCantine(p.role)) return false;
  if (cible === "tous") return true;
  if (cible === "convives") return p.role === "convive";
  if (cible === "parents") return p.role === "parent";
  if (cible === "semaine") return p.reserveCetteSemaine;
  return false;
}
