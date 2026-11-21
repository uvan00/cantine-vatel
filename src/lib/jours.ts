// Les jours de la cantine. Un jour s'écrit « AAAA-MM-JJ ». Abidjan est à l'heure GMT toute l'année : le jour d'un
// instant est sa date en temps universel, sans fuseau à gérer. Fonctions pures, testées par `npm test`.

/** Les réservations d'un jour ferment à 9 h ce jour-là : la cuisine sait alors combien de repas préparer. */
export const HEURE_CLOTURE = 9;
export const HEURE_CLOTURE_LISIBLE = `${HEURE_CLOTURE} h`;

const MS_JOUR = 86_400_000;
const debut = (jour: string) => Date.parse(`${jour}T00:00:00Z`);

/** Le jour d'un instant (millisecondes). */
export const jourIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Vrai pour un vrai jour du calendrier écrit « AAAA-MM-JJ » (« 2026-02-30 » est refusé). */
export const estUnJour = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(debut(v)) && jourIso(debut(v)) === v;

export const ajouterJours = (jour: string, n: number) => jourIso(debut(jour) + n * MS_JOUR);

/** Les `n` jours qui se suivent à partir de `jour` (lui compris). */
export const joursAPartirDe = (jour: string, n: number) => Array.from({ length: n }, (_, i) => ajouterJours(jour, i));

/** Le lundi de la semaine de ce jour. */
export const lundiDe = (jour: string) => ajouterJours(jour, -((new Date(debut(jour)).getUTCDay() + 6) % 7));

/** L'instant où les réservations de ce jour ferment, à l'heure réglée par la cantine (9 h par défaut). */
export const instantCloture = (jour: string, heure = HEURE_CLOTURE) => debut(jour) + heure * 3_600_000;
export const cloturePassee = (jour: string, maintenant: number, heure = HEURE_CLOTURE) => maintenant >= instantCloture(jour, heure);
/** « 9 h », « 10 h » */
export const clotureLisible = (heure = HEURE_CLOTURE) => `${heure} h`;

/** Vrai quand ce jour est fini (strictement avant aujourd'hui). */
export const jourPasse = (jour: string, maintenant: number) => jour < jourIso(maintenant);

const lire = (jour: string, options: Intl.DateTimeFormatOptions) =>
  new Date(debut(jour) + MS_JOUR / 2).toLocaleDateString("fr-FR", { ...options, timeZone: "UTC" });

/** « lundi 23 novembre » */
export const jourLong = (jour: string) => lire(jour, { weekday: "long", day: "numeric", month: "long" });
/** « lun. 23 » */
export const jourCourt = (jour: string) => lire(jour, { weekday: "short", day: "numeric" });
/** « lundi » */
export const nomDuJour = (jour: string) => lire(jour, { weekday: "long" });
/** « 23 » */
export const numeroDuJour = (jour: string) => lire(jour, { day: "numeric" });

/** « aujourd'hui », « demain », « hier », sinon « lundi 23 novembre ». */
export function jourProche(jour: string, maintenant: number) {
  const a = jourIso(maintenant);
  if (jour === a) return "aujourd'hui";
  if (jour === ajouterJours(a, 1)) return "demain";
  if (jour === ajouterJours(a, -1)) return "hier";
  return jourLong(jour);
}
