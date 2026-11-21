// Les restes pesés après le service : le gaspillage qui se mesure. La cantine pèse ce qui reste de chaque plat, en
// kilos comme sur la balance ; la base garde des grammes entiers (MenuJour.restes, vide tant que rien n'est pesé).
// Un chiffre de restes vient toujours d'une pesée : rien n'est estimé. Fonctions pures, testées par `npm test`.
import { jourIso } from "./jours.ts";

/** 200 kg : au-delà, c'est une faute de frappe. */
export const RESTES_MAX = 200_000;

/** Des restes : null (pas encore pesé) ou un entier de grammes, de 0 à 200 kg. */
export const restesValables = (grammes: number | null) =>
  grammes === null || (Number.isInteger(grammes) && grammes >= 0 && grammes <= RESTES_MAX);

/** Ce qu'on tape en kilos (« 1,3 », « 1.3 », « 0,45 », « 2 ») en grammes entiers ; null si ce n'est pas un poids. */
export function lireKilos(texte: string): number | null {
  const t = texte.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,3})?$/.test(t)) return null;
  return Math.round(Number(t) * 1000);
}

/** Les grammes à remettre dans le champ, en kilos : 1300 → « 1,3 ». */
export const enKilos = (grammes: number) =>
  (grammes / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 3, useGrouping: false });

/** « 450 g », « 1,3 kg », « 12 kg » */
export const poidsLisible = (grammes: number) =>
  grammes < 1000 ? `${grammes.toLocaleString("fr-FR")} g` : `${(grammes / 1000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} kg`;

/** On pèse les restes d'un jour commencé : aujourd'hui ou un jour passé, jamais un jour à venir. */
export const peutPeser = (jour: string, maintenant: number) => jour <= jourIso(maintenant);

/** Les grammes de restes par repas servi, arrondis ; null sans repas servi. */
export const parRepas = (grammes: number, servis: number) => (servis > 0 ? Math.round(grammes / servis) : null);

export type LignePesee = { platId: string; nom: string; restes: number | null; servis: number };

export type BilanRestes = {
  /** Les plats du jour pesés et servis au moins une fois : les seuls qui comptent. */
  pesees: number;
  grammes: number;
  servis: number;
  /** Null tant qu'aucun plat servi n'a été pesé. */
  parRepas: number | null;
  /** Le plat qui revient le plus en cuisine, par repas servi, toutes ses pesées additionnées. */
  plusLaisse: { nom: string; parRepas: number } | null;
};

/** Le bilan des pesées d'une période. Un plat pesé sans aucun repas servi ne compte pas : il n'a rien à comparer. */
export function bilanRestes(lignes: LignePesee[]): BilanRestes {
  const pesees = lignes.flatMap((l) => (l.restes !== null && l.servis > 0 ? [{ ...l, restes: l.restes }] : []));
  const parPlat = new Map<string, { nom: string; grammes: number; servis: number }>();
  for (const l of pesees) {
    const p = parPlat.get(l.platId) ?? { nom: l.nom, grammes: 0, servis: 0 };
    p.grammes += l.restes;
    p.servis += l.servis;
    parPlat.set(l.platId, p);
  }
  const classes = [...parPlat.values()]
    .map((p) => ({ nom: p.nom, parRepas: parRepas(p.grammes, p.servis) ?? 0 }))
    .sort((a, b) => b.parRepas - a.parRepas || a.nom.localeCompare(b.nom, "fr"));
  const grammes = pesees.reduce((s, l) => s + l.restes, 0);
  const servis = pesees.reduce((s, l) => s + l.servis, 0);
  return {
    pesees: pesees.length,
    grammes,
    servis,
    parRepas: parRepas(grammes, servis),
    plusLaisse: classes[0] && classes[0].parRepas > 0 ? classes[0] : null,
  };
}
