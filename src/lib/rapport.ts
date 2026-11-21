// Le rapport de la semaine (bonus 4 du cahier) : les chiffres du lundi au dimanche, à imprimer et en CSV. Mêmes
// définitions que le tableau de bord (src/lib/statistiques.ts, src/lib/restes.ts) : un repas compte tant qu'il n'est
// pas annulé, « non retiré » ne vaut que pour un jour fini, les recharges sont celles que la cantine a confirmées.
// Rien n'est inventé : un chiffre sans donnée vaut zéro, ou reste vide. Fonctions pures, testées par `npm test`.
import { ajouterJours, estUnJour, jourIso, joursAPartirDe, lundiDe, nomDuJour } from "./jours.ts";
import { moyenne } from "./menu.ts";
import { LIBELLE_MOYEN, type MoyenRecharge } from "./recharge.ts";
import { etatAffiche, resteAPayer } from "./reservation.ts";
import { bilanRestes, type BilanRestes, type LignePesee } from "./restes.ts";
import { soldeDe } from "./solde.ts";
import { classer, compte, nonRetires, notesParPlat, periode, pourcent, repasParPlat } from "./statistiques.ts";

/** Un repas de la semaine, tel que la base le garde : son jour, son état, le prix payé, son plat. */
export type RepasDuRapport = { jour: string; etat: string; prix: number; platId: string; nom: string; /** solde, a_payer, especes ou mobile_money ; absent : payé sur le solde. */ paiement?: string | null };
export type RechargeDuRapport = { montant: number; moyen: string; confirmeeLe: Date | string };
/** Une pesée des restes d'un plat du jour, avec ses repas servis. */
export type PeseeDuRapport = LignePesee & { jour: string };

export type LigneJour = {
  jour: string;
  /** Les repas qui comptent : réservés, servis ou non retirés, pas les annulés. */
  reserves: number;
  servis: number;
  nonRetires: number;
  annules: number;
  /** Ce que les repas qui comptent ont pris sur les soldes (un repas annulé est remboursé). */
  paye: number;
  /** Les grammes de restes pesés ce jour-là ; null sans pesée. */
  restes: number | null;
};

/** Un plat de la semaine : ses repas qui comptent, servis, non retirés (jours finis seulement), et sa note. */
export type LignePlatRapport = { platId: string; nom: string; repas: number; servis: number; nonRetires: number; note: number | null; avis: number };
export type LigneRecharge = { moyen: MoyenRecharge; nombre: number; montant: number };

export type Rapport = {
  lundi: string;
  dimanche: string;
  jours: LigneJour[];
  total: Omit<LigneJour, "jour">;
  /** La part des repas non retirés parmi ceux des jours finis, en pour cent ; null sans jour fini. */
  partNonRetires: number | null;
  plats: LignePlatRapport[];
  recharges: { lignes: LigneRecharge[]; nombre: number; montant: number };
  /** Les notes données aux repas de la semaine. */
  notes: { moyenne: number | null; avis: number };
  restes: BilanRestes;
};

const MOYENS: MoyenRecharge[] = ["cartflox", "pispi", "especes"];

/** Additionne des grammes ; null quand il n'y a rien à additionner. */
const grammes = (valeurs: (number | null)[]) => {
  const pesees = valeurs.filter((v): v is number => v !== null);
  return pesees.length > 0 ? pesees.reduce((s, v) => s + v, 0) : null;
};

/** Le rapport de la semaine qui commence ce lundi, à partir des lignes lues dans la base. */
export function rapportDeLaSemaine(
  lundi: string,
  d: { repas: RepasDuRapport[]; recharges: RechargeDuRapport[]; notes: { platId: string; note: number }[]; pesees: PeseeDuRapport[] },
  maintenant: number,
): Rapport {
  const dimanche = ajouterJours(lundi, 6);
  const dansLaSemaine = (jour: string) => jour >= lundi && jour <= dimanche;
  const repas = d.repas.filter((r) => dansLaSemaine(r.jour));
  const pesees = d.pesees.filter((p) => dansLaSemaine(p.jour));

  const jours: LigneJour[] = joursAPartirDe(lundi, 7).map((jour) => {
    const duJour = repas.filter((r) => r.jour === jour);
    const comptes = duJour.filter(compte);
    return {
      jour,
      reserves: comptes.length,
      servis: comptes.filter((r) => r.etat === "servie").length,
      nonRetires: comptes.filter((r) => etatAffiche(r, maintenant) === "non_retiree").length,
      annules: duJour.length - comptes.length,
      // Payé sur le solde ou au comptoir. Un repas réservé sans payer ne compte pas tant que la caisse ne l'a pas encaissé.
      paye: soldeDe(comptes.filter((r) => !resteAPayer(r)).map((r) => ({ montant: r.prix }))),
      restes: grammes(pesees.filter((p) => p.jour === jour).map((p) => p.restes)),
    };
  });
  const somme = (cle: "reserves" | "servis" | "nonRetires" | "annules" | "paye") => jours.reduce((s, j) => s + j[cle], 0);

  const notes = notesParPlat(d.notes);
  const plats = classer(repasParPlat(repas)).map((p) => {
    const duPlat = repas.filter((r) => r.platId === p.platId);
    return {
      ...p,
      servis: duPlat.filter((r) => r.etat === "servie").length,
      nonRetires: duPlat.filter((r) => etatAffiche(r, maintenant) === "non_retiree").length,
      note: notes.get(p.platId)?.moyenne ?? null,
      avis: notes.get(p.platId)?.avis ?? 0,
    };
  });

  const recues = d.recharges.filter((r) => dansLaSemaine(jourIso(new Date(r.confirmeeLe).getTime())));
  const lignes = MOYENS.map((moyen) => {
    const parMoyen = recues.filter((r) => r.moyen === moyen);
    return { moyen, nombre: parMoyen.length, montant: soldeDe(parMoyen) };
  });

  const finis = nonRetires(repas, maintenant);
  return {
    lundi,
    dimanche,
    jours,
    total: { reserves: somme("reserves"), servis: somme("servis"), nonRetires: somme("nonRetires"), annules: somme("annules"), paye: somme("paye"), restes: grammes(jours.map((j) => j.restes)) },
    partNonRetires: pourcent(finis.nombre, finis.total),
    plats,
    recharges: { lignes, nombre: recues.length, montant: soldeDe(recues) },
    notes: { moyenne: moyenne(d.notes.map((n) => n.note)), avis: d.notes.length },
    restes: bilanRestes(pesees),
  };
}

/**
 * Le lundi de la semaine demandée (`?semaine=`, n'importe quel jour de cette semaine). Sans demande valable, la semaine
 * en cours ; jamais au-delà, une semaine à venir n'a pas encore de rapport.
 */
export function lundiDuRapport(demande: unknown, aujourdhui: string): string {
  const cetteSemaine = lundiDe(aujourdhui);
  const lundi = typeof demande === "string" && estUnJour(demande) ? lundiDe(demande) : cetteSemaine;
  return lundi > cetteSemaine ? cetteSemaine : lundi;
}

/** « du lundi 16 au dimanche 22 novembre 2026 » : la période du rapport, avec son année. */
export const periodeDuRapport = (r: Pick<Rapport, "lundi" | "dimanche">) => `${periode(r.lundi, r.dimanche)} ${r.dimanche.slice(0, 4)}`;

/** « 4,5 » : une note moyenne au dixième, avec la virgule ; vide sans note. */
export const noteCourte = (note: number | null) =>
  note === null ? "" : note.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Un champ de CSV : entre guillemets s'il contient le séparateur, un guillemet ou un retour à la ligne. */
export function champCsv(v: string | number | null): string {
  const t = v === null ? "" : String(v);
  return /[";\r\n]/.test(t) ? `"${t.replaceAll('"', '""')}"` : t;
}

/**
 * Le rapport en CSV, pour un tableur réglé en français : les mêmes tableaux que la page, séparés par une ligne vide,
 * le point-virgule pour séparer, des nombres sans espaces (les montants en francs, les restes en grammes), et la marque
 * UTF-8 en tête pour que le tableur affiche les accents.
 */
export function rapportEnCsv(r: Rapport, cantine: string): string {
  const t = r.total;
  const lignes: (string | number | null)[][] = [
    ["Rapport de la semaine", cantine, periodeDuRapport(r)],
    [],
    ["Date", "Jour", "Réservés", "Servis", "Non retirés", "Annulés", "Payé (F CFA)", "Restes pesés (g)"],
    ...r.jours.map((j) => [j.jour, nomDuJour(j.jour), j.reserves, j.servis, j.nonRetires, j.annules, j.paye, j.restes]),
    ["Total", "", t.reserves, t.servis, t.nonRetires, t.annules, t.paye, t.restes],
    [],
    ["Plat", "Repas", "Servis", "Non retirés", "Note moyenne", "Avis"],
    ...r.plats.map((p) => [p.nom, p.repas, p.servis, p.nonRetires, noteCourte(p.note), p.avis]),
    [],
    ["Recharges confirmées", "Nombre", "Montant (F CFA)"],
    ...r.recharges.lignes.map((l) => [LIBELLE_MOYEN[l.moyen], l.nombre, l.montant]),
    ["Total", r.recharges.nombre, r.recharges.montant],
  ];
  return `\uFEFF${lignes.map((l) => l.map(champCsv).join(";")).join("\r\n")}\r\n`;
}
