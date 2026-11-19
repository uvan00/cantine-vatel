// Les chiffres du tableau de bord de la cantine. Ils se calculent ICI, à partir des lignes lues dans la base
// (src/lib/donnees-admin.ts) : aucun n'est inventé, et un chiffre sans donnée vaut zéro ou « rien ».
// Fonctions pures, testées par `npm test`.
import { ajouterJours, jourIso, jourLong } from "./jours.ts";
import { moyenne } from "./menu.ts";
import { etatAffiche } from "./reservation.ts";
import { soldeDe } from "./solde.ts";

/** Un repas compte dans les chiffres tant qu'il n'est pas annulé. */
export const compte = (r: { etat: string }) => r.etat !== "annulee";

export type ChiffresService = { reserves: number; servis: number; aServir: number };

/** Réservés, servis, à servir : ce que le comptoir suit le jour même. Réservés = servis + à servir. */
export function chiffresDuService(repas: { etat: string }[]): ChiffresService {
  const servis = repas.filter((r) => r.etat === "servie").length;
  const aServir = repas.filter((r) => r.etat === "reservee").length;
  return { reserves: servis + aServir, servis, aServir };
}

/** Le nombre de repas de chaque jour, dans l'ordre des jours donnés (zéro pour un jour sans repas). */
export function repasParJour(jours: string[], repas: { jour: string; etat: string }[]): number[] {
  const parJour = new Map<string, number>();
  for (const r of repas) if (compte(r)) parJour.set(r.jour, (parJour.get(r.jour) ?? 0) + 1);
  return jours.map((j) => parJour.get(j) ?? 0);
}

export type LignePlat = { platId: string; nom: string; repas: number };

/** Les repas additionnés par plat, sur tous les jours donnés. */
export function repasParPlat(repas: { etat: string; platId: string; nom: string }[]): LignePlat[] {
  const parPlat = new Map<string, LignePlat>();
  for (const r of repas) {
    if (!compte(r)) continue;
    const ligne = parPlat.get(r.platId) ?? { platId: r.platId, nom: r.nom, repas: 0 };
    ligne.repas += 1;
    parPlat.set(r.platId, ligne);
  }
  return [...parPlat.values()];
}

/** Du plus réservé au moins réservé ; à égalité, par ordre alphabétique. `limite` garde les premiers. */
export function classer<T extends { nom: string; repas: number }>(lignes: T[], limite = lignes.length): T[] {
  return [...lignes].sort((a, b) => b.repas - a.repas || a.nom.localeCompare(b.nom, "fr")).slice(0, limite);
}

/**
 * Les sept jours terminés avant aujourd'hui. « Non retiré » n'a de sens que sur un jour fini : aujourd'hui se lit à
 * part, en haut du tableau de bord.
 */
export const septDerniersJours = (aujourdhui: string) => ({ debut: ajouterJours(aujourdhui, -7), fin: ajouterJours(aujourdhui, -1) });

/** Les repas non retirés (encore « réservés » alors que leur jour est passé), parmi les repas des jours passés. */
export function nonRetires(repas: { jour: string; etat: string }[], maintenant: number): { nombre: number; total: number } {
  const aujourdhui = jourIso(maintenant);
  const passes = repas.filter((r) => compte(r) && r.jour < aujourdhui);
  return { nombre: passes.filter((r) => etatAffiche(r, maintenant) === "non_retiree").length, total: passes.length };
}

/** La part en pour cent, arrondie à l'entier ; null quand il n'y a rien à comparer. */
export const pourcent = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : null);

/** Le total des recharges confirmées entre deux jours compris. La somme est celle du journal (src/lib/solde.ts). */
export function rechargesConfirmees(recharges: { montant: number; confirmeeLe: Date | string }[], debut: string, fin: string): number {
  return soldeDe(recharges.filter((r) => {
    const jour = jourIso(new Date(r.confirmeeLe).getTime());
    return jour >= debut && jour <= fin;
  }));
}

export type NotePlat = { moyenne: number | null; avis: number };

/** La note moyenne de chaque plat et son nombre d'avis. Un plat sans avis n'est pas dans la liste. */
export function notesParPlat(notes: { platId: string; note: number }[]): Map<string, NotePlat> {
  const parPlat = new Map<string, number[]>();
  for (const n of notes) parPlat.set(n.platId, [...(parPlat.get(n.platId) ?? []), n.note]);
  return new Map([...parPlat].map(([platId, liste]) => [platId, { moyenne: moyenne(liste), avis: liste.length }]));
}

/** « 4,3 sur 5 » */
export const noteLisible = (note: number) => `${note.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} sur 5`;

/** La part d'une barre dans la plus haute, de 0 à 1. Zéro reste zéro, même quand tout est à zéro. */
export const partDeBarre = (valeur: number, max: number) => (max > 0 ? Math.max(0, Math.min(1, valeur / max)) : 0);

/**
 * « du lundi 16 au dimanche 22 novembre », « du lundi 30 novembre au dimanche 6 décembre ». Sans les noms des jours :
 * « du 16 au 22 novembre ».
 */
export function periode(debut: string, fin: string, avecJours = true): string {
  const [jourDebut, numeroDebut, ...moisDebut] = jourLong(debut).split(" ");
  const [jourFin, numeroFin, ...moisFin] = jourLong(fin).split(" ");
  const memeMois = moisDebut.join(" ") === moisFin.join(" ");
  const depuis = [avecJours ? jourDebut : "", numeroDebut, memeMois ? "" : moisDebut.join(" ")].filter(Boolean).join(" ");
  const jusqua = [avecJours ? jourFin : "", numeroFin, moisFin.join(" ")].filter(Boolean).join(" ");
  return `du ${depuis} au ${jusqua}`;
}
