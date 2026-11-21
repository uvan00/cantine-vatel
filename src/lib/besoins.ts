// Les besoins de la cuisine (cahier des charges, section 11, bonus 2) : la fiche recette de chaque plat donne la quantité
// de chaque ingrédient pour une portion ; multipliée par les réservations du jour, elle dit ce qu'il faut sortir. Pure,
// testée par `npm test` (besoins.test.ts).
//
// Depuis le 21/11/2026 (lot 1 validé par le propriétaire) : les rayons de la réserve, le détail par plat de chaque
// besoin, le plan de production plat par plat, l'image de chaque ingrédient, l'alerte allergies et les restes moyens.
import { liste, pluriel } from "./format.ts";
import { parRepas, type LignePesee } from "./restes.ts";

export const UNITES = ["g", "ml", "piece"] as const;
export type Unite = (typeof UNITES)[number];
export const LIBELLE_UNITE: Record<Unite, string> = { g: "grammes", ml: "millilitres", piece: "pièces" };

export const LIGNES_MAX = 30;
export const QUANTITE_MAX = 100_000;
export const NOM_INGREDIENT_MAX = 60;

export type LigneFiche = { nom: string; unite: string; quantite: number };

/** Pourquoi cette fiche recette ne s'enregistre pas, en une phrase ; null : elle s'enregistre. */
export function refusFiche(lignes: LigneFiche[]): string | null {
  if (lignes.length > LIGNES_MAX) return `${LIGNES_MAX} ingrédients au plus par plat`;
  const vus = new Set<string>();
  for (const l of lignes) {
    const nom = l.nom.trim();
    if (!nom || nom.length > NOM_INGREDIENT_MAX) return `Un nom d'ingrédient de 1 à ${NOM_INGREDIENT_MAX} caractères`;
    if (!(UNITES as readonly string[]).includes(l.unite)) return "Une unité : grammes, millilitres ou pièces";
    if (!Number.isInteger(l.quantite) || l.quantite < 1 || l.quantite > QUANTITE_MAX) return "Une quantité entière par portion, de 1 à 100 000";
    const cle = nom.toLocaleLowerCase("fr");
    if (vus.has(cle)) return `« ${nom} » est déjà dans la fiche`;
    vus.add(cle);
  }
  return null;
}

export type PlatDuJour = {
  platId: string;
  nom: string;
  /** Les repas réservés pour ce plat ce jour-là, annulés exclus. */
  reservations: number;
  lignes: { ingredientId: string; nom: string; unite: Unite; quantite: number }[];
};

/** `parPlat` : ce que chaque plat en demande, dans l'ordre des plats. */
export type Besoin = { ingredientId: string; nom: string; unite: Unite; total: number; plats: string[]; parPlat: { nom: string; total: number }[] };

/** Ce qu'il faut sortir pour ce jour : chaque ingrédient, additionné sur tous les plats ; et les plats sans fiche. */
export function besoinsDuJour(plats: PlatDuJour[]): { besoins: Besoin[]; sansFiche: string[] } {
  const parIngredient = new Map<string, Besoin>();
  for (const p of plats) {
    if (p.reservations <= 0) continue;
    for (const l of p.lignes) {
      const b = parIngredient.get(l.ingredientId) ?? { ingredientId: l.ingredientId, nom: l.nom, unite: l.unite, total: 0, plats: [], parPlat: [] };
      b.total += l.quantite * p.reservations;
      b.plats.push(p.nom);
      b.parPlat.push({ nom: p.nom, total: l.quantite * p.reservations });
      parIngredient.set(l.ingredientId, b);
    }
  }
  const besoins = [...parIngredient.values()].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  const sansFiche = plats.filter((p) => p.reservations > 0 && p.lignes.length === 0).map((p) => p.nom);
  return { besoins, sansFiche };
}

/** « 12,5 kg », « 850 g », « 3,2 l », « 750 ml », « 45 pièces » */
export function quantiteLisible(total: number, unite: Unite): string {
  const nombre = (v: number) => v.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  if (unite === "g") return total >= 1000 ? `${nombre(total / 1000)} kg` : `${nombre(total)} g`;
  if (unite === "ml") return total >= 1000 ? `${nombre(total / 1000)} l` : `${nombre(total)} ml`;
  return `${nombre(total)} ${total > 1 ? "pièces" : "pièce"}`;
}

/** Sous un besoin : le plat qui le demande, ou, s'ils sont plusieurs, la part de chacun (« Riz sauce arachide 1,08 kg, Kedjenou 1,32 kg »). */
export function detailDuBesoin(b: Besoin): string {
  if (b.parPlat.length <= 1) return b.parPlat[0]?.nom ?? liste(b.plats);
  return b.parPlat.map((p) => `${p.nom} ${quantiteLisible(p.total, b.unite)}`).join(", ");
}

/* ── Les rayons de la réserve ────────────────────────────────────────────── */

/** L'ordre de la liste de sortie : on passe d'un rayon à l'autre comme dans la réserve. */
export const RAYONS = ["Viandes et poissons", "Féculents", "Légumes", "Œufs et laitiers", "Épicerie", "Autres"] as const;
export type Rayon = (typeof RAYONS)[number];

/** En minuscules, sans accent, « œ » écrit « oe » : de quoi comparer des noms tapés à la main. */
const simplifier = (texte: string) =>
  texte.toLocaleLowerCase("fr").replace(/œ/g, "oe").replace(/æ/g, "ae").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/’/g, "'").trim();

/**
 * Les mots qui rangent un ingrédient, essayés dans cet ordre : l'épicerie passe d'abord (« pâte d'arachide »,
 * « concentré de tomate »), puis les œufs et le lait, les viandes, les féculents, les légumes. Un mot seul se compare
 * à un mot entier du nom (au pluriel aussi) : « chorizo » n'est pas du riz.
 */
const MOTS_DES_RAYONS: [Rayon, string[]][] = [
  ["Épicerie", ["pate d'arachide", "huile", "arachide", "sel", "sucre", "cube", "bouillon", "epice", "poivre", "farine", "vinaigre", "moutarde", "mayonnaise", "concentre", "levure", "soumbala"]],
  ["Œufs et laitiers", ["oeuf", "lait", "beurre", "fromage", "yaourt", "creme"]],
  ["Viandes et poissons", ["boeuf", "veau", "poulet", "pintade", "dinde", "canard", "mouton", "agneau", "chevre", "cabri", "porc", "viande", "abats", "poisson", "thon", "sardine", "maquereau", "tilapia", "capitaine", "carpe", "crevette", "escargot", "saucisse", "jambon"]],
  ["Féculents", ["riz", "attieke", "igname", "banane", "plantain", "manioc", "foutou", "placali", "semoule", "pates", "spaghetti", "macaroni", "pain", "mais", "couscous", "pomme de terre", "patate", "taro", "fonio", "mil", "sorgho"]],
  ["Légumes", ["tomate", "oignon", "gombo", "aubergine", "piment", "carotte", "chou", "ail", "gingembre", "poivron", "salade", "laitue", "concombre", "haricot", "lentille", "epinard", "feuille", "persil", "celeri", "poireau", "courgette", "citron", "legume"]],
];

/** Le rayon de la réserve où l'on trouve cet ingrédient, d'après son nom ; « Autres » s'il n'est pas reconnu. */
export function rayonDe(nom: string): Rayon {
  const n = simplifier(nom);
  const mots = n.split(/[^a-z]+/).filter(Boolean);
  const present = (cle: string) => (/[ ']/.test(cle) ? n.includes(cle) : mots.some((m) => m === cle || m === `${cle}s` || m === `${cle}x`));
  for (const [rayon, cles] of MOTS_DES_RAYONS) if (cles.some(present)) return rayon;
  return "Autres";
}

/** La liste de sortie rangée par rayon, dans l'ordre de RAYONS ; un rayon vide n'apparaît pas. */
export function besoinsParRayon(besoins: Besoin[]): { rayon: Rayon; besoins: Besoin[] }[] {
  return RAYONS.map((rayon) => ({ rayon, besoins: besoins.filter((b) => rayonDe(b.nom) === rayon) })).filter((g) => g.besoins.length > 0);
}

/* ── Le plan de production ───────────────────────────────────────────────── */

export type LigneProduction = { ingredientId: string; nom: string; unite: Unite; parPortion: number; total: number };

/** La fiche recette d'un plat multipliée par ses réservations : ce qu'il faut pour toutes ses portions. */
export function planDuPlat(p: PlatDuJour): { portions: number; lignes: LigneProduction[] } {
  const portions = Math.max(0, p.reservations);
  return {
    portions,
    lignes: p.lignes.map((l) => ({ ingredientId: l.ingredientId, nom: l.nom, unite: l.unite, parPortion: l.quantite, total: l.quantite * portions })),
  };
}

/* ── L'image d'un ingrédient ─────────────────────────────────────────────── */

/** Les ingrédients qui ont leur image dans public/ingredients (dessinés par Codex le 21/11/2026, détourés sur blanc). */
export const IMAGES_INGREDIENTS: ReadonlySet<string> = new Set([
  "attieke", "banane-plantain", "boeuf", "huile", "igname", "oignon", "poisson", "poulet", "pate-d-arachide", "riz", "tomate", "oeuf",
]);

/** « Pâte d'arachide » → « pate-d-arachide » */
export const slugIngredient = (nom: string) => simplifier(nom).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** L'image de cet ingrédient (« /ingredients/riz.webp »), au singulier comme au pluriel ; null s'il n'en a pas. */
export function imageIngredient(nom: string): string | null {
  const s = slugIngredient(nom);
  const trouve = [s, s.replace(/s$/, "")].find((v) => IMAGES_INGREDIENTS.has(v));
  return trouve ? `/ingredients/${trouve}.webp` : null;
}

/* ── L'alerte allergies et les restes ────────────────────────────────────── */

/** Un allergène des plats du jour : les plats qui le contiennent, et les convives allergiques qui mangent ce jour-là. */
export type AllergieDuJour = { allergene: string; plats: string[]; convives: number };

/** Ce qui suit le nom de l'allergène : « dans Riz sauce arachide. 2 convives allergiques mangent demain : leurs plats à l'écart ». */
export function phraseAllergie(a: AllergieDuJour, quand: string): string {
  const plusieurs = a.convives > 1;
  return `dans ${liste(a.plats)}. ${pluriel(a.convives, "convive allergique", "convives allergiques")} ${plusieurs ? "mangent" : "mange"} ${quand} : ${plusieurs ? "leurs plats" : "son plat"} à l'écart`;
}

/**
 * Les grammes de restes par repas servi de chaque plat, toutes ses pesées additionnées (src/lib/restes.ts). Un plat
 * sans pesée, ou pesé sans repas servi, n'y est pas : rien n'est estimé.
 */
export function restesParPlat(lignes: LignePesee[]): Map<string, number> {
  const cumul = new Map<string, { grammes: number; servis: number }>();
  for (const l of lignes) {
    if (l.restes === null || l.servis <= 0) continue;
    const c = cumul.get(l.platId) ?? { grammes: 0, servis: 0 };
    c.grammes += l.restes;
    c.servis += l.servis;
    cumul.set(l.platId, c);
  }
  const resultat = new Map<string, number>();
  for (const [platId, c] of cumul) {
    const g = parRepas(c.grammes, c.servis);
    if (g !== null) resultat.set(platId, g);
  }
  return resultat;
}
