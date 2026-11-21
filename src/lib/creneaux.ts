// Les créneaux de passage (choix du propriétaire du 21/11/2026 : gérer les commandes par heure,
// une capacité par créneau). Quand la cantine les ouvre, le convive choisit son heure de passage
// en réservant : la file s'étale sur le service. Fonctions pures, testées par `npm test` (creneaux.test.ts).

const HEURE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** « 12:15 » : une heure de la journée écrite sur 5 caractères. */
export const heureValable = (h: string) => HEURE.test(h);

const enMinutes = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
const ecrire = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Au plus 48 créneaux dans un service : au-delà, c'est une faute de frappe. */
export const CRENEAUX_MAX = 48;

/** Les heures de passage, de `debut` (compris) à `fin` (exclu), toutes les `pas` minutes : 11:45, 12:00, 12:15… */
export function creneauxEntre(debut: string, fin: string, pas: number): string[] {
  if (!heureValable(debut) || !heureValable(fin) || !Number.isInteger(pas) || pas < 5 || pas > 120) return [];
  const heures: string[] = [];
  for (let m = enMinutes(debut); m < enMinutes(fin) && heures.length < CRENEAUX_MAX; m += pas) heures.push(ecrire(m));
  return heures;
}

/** « 12 h 15 », « 12 h » */
export function creneauLisible(h: string) {
  if (!heureValable(h)) return h;
  const heures = Number(h.slice(0, 2)), minutes = h.slice(3, 5);
  return minutes === "00" ? `${heures} h` : `${heures} h ${minutes}`;
}

export type EtatCreneau = { heure: string; pris: number; libres: number; complet: boolean };

/** Chaque heure de passage avec ses places prises et libres. */
export const etatsCreneaux = (heures: string[], prisParHeure: Record<string, number>, capacite: number): EtatCreneau[] =>
  heures.map((heure) => {
    const pris = prisParHeure[heure] ?? 0;
    return { heure, pris, libres: Math.max(0, capacite - pris), complet: pris >= capacite };
  });

export type VerdictCreneau = { ok: true } | { ok: false; phrase: string };

/**
 * L'heure de passage d'une réservation. Sans créneaux ouverts, rien à choisir. Sinon l'heure doit être l'une de celles
 * du service, et il doit y rester de la place.
 */
export function verdictCreneau(c: { actifs: boolean; choisi: string | null; heures: string[]; pris: number; capacite: number }): VerdictCreneau {
  if (!c.actifs) return { ok: true };
  if (!c.choisi) return { ok: false, phrase: "Choisis ton heure de passage" };
  if (!c.heures.includes(c.choisi)) return { ok: false, phrase: "Cette heure de passage n'existe pas" };
  if (c.pris >= c.capacite) return { ok: false, phrase: `Le passage de ${creneauLisible(c.choisi)} est complet, choisis-en un autre` };
  return { ok: true };
}
