// La comptabilité de la cantine (demande du propriétaire du 21/11/2026), dans la rubrique Recharges :
//   - l'argent entré : les recharges confirmées, par moyen de paiement ;
//   - les repas vendus : un repas est gagné quand il est servi, ou quand son jour passe sans qu'on vienne le chercher ;
//     payé pour un jour à venir, il ne l'est pas encore ;
//   - les dépenses : ce que la cantine paie, noté à la main ;
//   - le bilan : gagné moins dépensé ;
//   - les soldes : l'argent des élèves en dépôt, qui leur appartient tant qu'ils n'ont pas mangé.
// Tout se compte en francs CFA entiers. Pur, testé par `npm test` (comptabilite.test.ts).
import { ajouterJours, estUnJour, jourLong, lundiDe } from "./jours.ts";
import { champCsv } from "./rapport.ts";
import { periode as periodeEnMots } from "./statistiques.ts";

/* ── Les périodes ──────────────────────────────────────────────────────────── */

export const TYPES_PERIODE = [
  { id: "jour", libelle: "Jour" },
  { id: "semaine", libelle: "Semaine" },
  { id: "mois", libelle: "Mois" },
  // Du jour choisi au jour choisi (demande du propriétaire du 21/11/2026).
  { id: "dates", libelle: "Dates" },
] as const;
export type TypePeriode = (typeof TYPES_PERIODE)[number]["id"];
export type Periode = { type: TypePeriode; debut: string; fin: string };

export const estTypePeriode = (v: string): v is TypePeriode => TYPES_PERIODE.some((t) => t.id === v);

/** Une période choisie à la main dure au plus un an. */
export const DATES_MAX_JOURS = 366;
const ecartEnJours = (debut: string, fin: string) => Math.round((Date.parse(`${fin}T00:00:00Z`) - Date.parse(`${debut}T00:00:00Z`)) / 86_400_000);

/** Du jour choisi au jour choisi, dans le bon ordre, et un an au plus. */
export function periodeEntre(du: string, au: string): Periode {
  const [debut, fin] = du <= au ? [du, au] : [au, du];
  return { type: "dates", debut, fin: ecartEnJours(debut, fin) >= DATES_MAX_JOURS ? ajouterJours(debut, DATES_MAX_JOURS - 1) : fin };
}

/** La période qui contient ce jour : le jour même, sa semaine (du lundi au dimanche) ou son mois. */
export function periodeDe(type: TypePeriode, jour: string): Periode {
  if (type === "jour" || type === "dates") return { type, debut: jour, fin: jour };
  if (type === "semaine") {
    const lundi = lundiDe(jour);
    return { type, debut: lundi, fin: ajouterJours(lundi, 6) };
  }
  const [annee, mois] = jour.split("-").map(Number);
  const debut = `${annee}-${String(mois).padStart(2, "0")}-01`;
  // Le jour 0 du mois suivant est le dernier jour de ce mois.
  const fin = new Date(Date.UTC(annee, mois, 0)).toISOString().slice(0, 10);
  return { type, debut, fin };
}

/** La période d'avant ; choisie à la main, la même durée juste avant. */
export function periodePrecedente(p: Periode): Periode {
  if (p.type !== "dates") return periodeDe(p.type, ajouterJours(p.debut, -1));
  const n = ecartEnJours(p.debut, p.fin) + 1;
  return { type: "dates", debut: ajouterJours(p.debut, -n), fin: ajouterJours(p.fin, -n) };
}
/** La période d'après ; choisie à la main, la même durée juste après. */
export function periodeSuivante(p: Periode): Periode {
  if (p.type !== "dates") return periodeDe(p.type, ajouterJours(p.fin, 1));
  const n = ecartEnJours(p.debut, p.fin) + 1;
  return { type: "dates", debut: ajouterJours(p.debut, n), fin: ajouterJours(p.fin, n) };
}

/** « samedi 21 novembre », « du 16 au 22 novembre », « novembre 2026 ». */
export function periodeLisible(p: Periode): string {
  if (p.type === "jour" || (p.type === "dates" && p.debut === p.fin)) return jourLong(p.debut);
  if (p.type === "semaine" || p.type === "dates") return periodeEnMots(p.debut, p.fin, false);
  return new Date(`${p.debut}T12:00:00Z`).toLocaleDateString("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** Les jours de la période, du premier au dernier. */
export function joursDe(p: Periode): string[] {
  const jours: string[] = [];
  for (let j = p.debut; j <= p.fin; j = ajouterJours(j, 1)) jours.push(j);
  return jours;
}

/* ── L'argent entré ────────────────────────────────────────────────────────── */

export const MOYENS_RECHARGE: { id: string; libelle: string }[] = [
  { id: "cartflox", libelle: "Mobile Money (Cartflox)" },
  { id: "especes", libelle: "Espèces au comptoir" },
  { id: "pispi", libelle: "QR universel" },
];
const libelleMoyen = (id: string) => MOYENS_RECHARGE.find((m) => m.id === id)?.libelle ?? "Autre";

/** Une recharge confirmée : `confirmeeLe` en ISO (Abidjan vit à l'heure UTC : les dix premiers caractères sont le jour). */
export type RechargeCompta = { montant: number; moyen: string; confirmeeLe: string };

export function encaissements(recharges: RechargeCompta[], p: Periode) {
  const dans = recharges.filter((r) => { const j = r.confirmeeLe.slice(0, 10); return j >= p.debut && j <= p.fin; });
  const total = dans.reduce((s, r) => s + r.montant, 0);
  const parMoyen = MOYENS_RECHARGE.map((m) => {
    const lignes = dans.filter((r) => r.moyen === m.id);
    return { id: m.id, libelle: m.libelle, nombre: lignes.length, montant: lignes.reduce((s, r) => s + r.montant, 0) };
  }).filter((m) => m.nombre > 0);
  const autres = dans.filter((r) => !MOYENS_RECHARGE.some((m) => m.id === r.moyen));
  if (autres.length) parMoyen.push({ id: "autre", libelle: libelleMoyen("autre"), nombre: autres.length, montant: autres.reduce((s, r) => s + r.montant, 0) });
  const parJour = joursDe(p).map((jour) => {
    const lignes = dans.filter((r) => r.confirmeeLe.slice(0, 10) === jour);
    return { jour, nombre: lignes.length, montant: lignes.reduce((s, r) => s + r.montant, 0) };
  });
  return { total, nombre: dans.length, parMoyen, parJour };
}

/* ── Les repas vendus ──────────────────────────────────────────────────────── */

/** Un repas réservé : son jour, son prix payé, son état (reservee, servie, annulee) et son plat. */
export type RepasCompta = { jour: string; prix: number; etat: string; plat: string };

const somme = (repas: RepasCompta[]) => repas.reduce((s, r) => s + r.prix, 0);

export function ventes(repas: RepasCompta[], p: Periode, aujourdhui: string) {
  const dans = repas.filter((r) => r.jour >= p.debut && r.jour <= p.fin);
  const servis = dans.filter((r) => r.etat === "servie");
  // Réservé et jamais retiré, son jour passé : la cuisine l'a préparé, il n'est pas remboursé, il est gagné.
  const nonRetires = dans.filter((r) => r.etat === "reservee" && r.jour < aujourdhui);
  // Payé, mais pour aujourd'hui (pas encore servi) ou un jour à venir : pas encore gagné.
  const aVenir = dans.filter((r) => r.etat === "reservee" && r.jour >= aujourdhui);
  const annules = dans.filter((r) => r.etat === "annulee");
  const gagnes = [...servis, ...nonRetires];
  const parPlat = [...new Set(gagnes.map((r) => r.plat))]
    .map((plat) => { const l = gagnes.filter((r) => r.plat === plat); return { plat, nombre: l.length, montant: somme(l) }; })
    .sort((a, b) => b.montant - a.montant || a.plat.localeCompare(b.plat, "fr"));
  const parJour = joursDe(p).map((jour) => { const l = gagnes.filter((r) => r.jour === jour); return { jour, nombre: l.length, montant: somme(l) }; });
  return {
    gagne: somme(gagnes),
    servis: { nombre: servis.length, montant: somme(servis) },
    nonRetires: { nombre: nonRetires.length, montant: somme(nonRetires) },
    aVenir: { nombre: aVenir.length, montant: somme(aVenir) },
    annules: { nombre: annules.length, montant: somme(annules) },
    parPlat,
    parJour,
  };
}

/* ── Les dépenses ──────────────────────────────────────────────────────────── */

export const CATEGORIES = [
  { id: "ingredients", libelle: "Ingrédients" },
  { id: "gaz", libelle: "Gaz et énergie" },
  { id: "emballages", libelle: "Emballages et entretien" },
  { id: "salaires", libelle: "Salaires" },
  { id: "autres", libelle: "Autres" },
] as const;
export const MOYENS_DEPENSE = [
  { id: "especes", libelle: "Espèces" },
  { id: "mobile_money", libelle: "Mobile Money" },
  { id: "virement", libelle: "Virement" },
  { id: "autre", libelle: "Autre" },
] as const;
export const libelleCategorie = (id: string) => CATEGORIES.find((c) => c.id === id)?.libelle ?? "Autres";
export const libelleMoyenDepense = (id: string) => MOYENS_DEPENSE.find((m) => m.id === id)?.libelle ?? "Autre";

export const MONTANT_DEPENSE_MAX = 10_000_000;
export const LIBELLE_DEPENSE_MAX = 120;
export const FOURNISSEUR_MAX = 80;

export type DepenseSaisie = { jour: string; categorie: string; libelle: string; montant: number; fournisseur: string; moyen: string };

/** Pourquoi cette dépense ne se note pas, en une phrase ; null : elle se note. */
export function refusDepense(d: DepenseSaisie, aujourdhui: string): string | null {
  if (!estUnJour(d.jour)) return "La date de la dépense";
  if (d.jour > aujourdhui) return "Une dépense se note le jour où elle est payée, pas avant";
  if (!CATEGORIES.some((c) => c.id === d.categorie)) return "Une catégorie de la liste";
  const libelle = d.libelle.trim();
  if (libelle.length < 2 || libelle.length > LIBELLE_DEPENSE_MAX) return `Ce qui a été payé, en 2 à ${LIBELLE_DEPENSE_MAX} caractères`;
  if (!Number.isInteger(d.montant) || d.montant < 1 || d.montant > MONTANT_DEPENSE_MAX) return "Un montant entier en F CFA, de 1 à 10 000 000";
  if (d.fournisseur.trim().length > FOURNISSEUR_MAX) return `Le fournisseur en ${FOURNISSEUR_MAX} caractères au plus`;
  if (!MOYENS_DEPENSE.some((m) => m.id === d.moyen)) return "Un moyen de paiement de la liste";
  return null;
}

export type DepenseCompta = { jour: string; categorie: string; montant: number };

export function depensesDe(depenses: DepenseCompta[], p: Periode) {
  const dans = depenses.filter((d) => d.jour >= p.debut && d.jour <= p.fin);
  const parCategorie = CATEGORIES.map((c) => {
    const l = dans.filter((d) => (CATEGORIES.some((x) => x.id === d.categorie) ? d.categorie : "autres") === c.id);
    return { id: c.id, libelle: c.libelle, nombre: l.length, montant: l.reduce((s, d) => s + d.montant, 0) };
  }).filter((c) => c.nombre > 0);
  return { total: dans.reduce((s, d) => s + d.montant, 0), nombre: dans.length, parCategorie };
}

/* ── Le bilan ──────────────────────────────────────────────────────────────── */

/** Gagné (les repas servis ou non retirés) moins dépensé : positif, la cantine gagne ; négatif, elle perd. */
export const bilan = (gagne: number, depense: number) => ({ gagne, depense, resultat: gagne - depense });

/* ── Les soldes ────────────────────────────────────────────────────────────── */

/** L'argent des élèves en dépôt : le total des soldes positifs, et chaque compte qui a de l'argent, du plus riche au moins. */
export function soldes(comptes: { id: string; nom: string; groupe: string; solde: number }[]) {
  const avecArgent = comptes.filter((c) => c.solde > 0).sort((a, b) => b.solde - a.solde || a.nom.localeCompare(b.nom, "fr"));
  return { total: avecArgent.reduce((s, c) => s + c.solde, 0), comptes: avecArgent, sansArgent: comptes.length - avecArgent.length };
}

/* ── Pour le comptable ─────────────────────────────────────────────────────── */

/** Un fichier CSV que les tableurs en français ouvrent tels quels : point-virgule, retour Windows, marque UTF-8. */
export const enCsv = (lignes: (string | number | null)[][]) => `\uFEFF${lignes.map((l) => l.map(champCsv).join(";")).join("\r\n")}\r\n`;
