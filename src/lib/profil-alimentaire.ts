// Le profil alimentaire : ce qu'un convive ne mange pas, face à ce qu'un plat déclare. Une seule fonction décide si
// un plat convient. L'application répète ce que la cantine a déclaré : elle ne garantit pas la composition d'un plat.
// Fonctions pures, testées par `npm test`.
import { ALLERGENES, ETIQUETTE_PORC, etiquettesAllergenes, etiquettesRegimes, type Etiquette } from "./listes.ts";
import { liste } from "./format.ts";

export type ProfilAlimentaire = { allergenes: string[]; regimes: string[] };
export type PlatDeclare = { allergenes: string[]; porc: boolean; vegetarien: boolean };

/** Les raisons pour lesquelles ce plat ne convient pas à ce profil (« contient de l'arachide »). Vide : il convient. */
export function incompatibilites(profil: ProfilAlimentaire, plat: PlatDeclare): string[] {
  const raisons: string[] = [];
  for (const a of ALLERGENES) {
    if (plat.allergenes.includes(a.id) && profil.allergenes.includes(a.id)) raisons.push(`contient ${a.avec}`);
  }
  if (profil.regimes.includes("sans-porc") && plat.porc) raisons.push("contient du porc");
  if (profil.regimes.includes("vegetarien") && !plat.vegetarien) raisons.push("n'est pas végétarien");
  return raisons;
}

/** « Ce plat contient de l'arachide et n'est pas végétarien » */
export const phraseIncompatibilites = (raisons: string[]) => `Ce plat ${liste(raisons)}`;

/* ── Les mêmes faits, en étiquettes (un dessin et un nom) ──────────────────── */

/** Ce qu'un plat déclare contenir : ses allergènes dans l'ordre de la liste, puis le porc. */
export const etiquettesDuPlat = (plat: PlatDeclare): Etiquette[] =>
  [...etiquettesAllergenes(plat.allergenes), ...(plat.porc ? [ETIQUETTE_PORC] : [])];

/** Ce qu'un convive ne mange pas : ses allergènes, puis ses régimes (« sans porc », « végétarien »). */
export const etiquettesDuProfil = (profil: ProfilAlimentaire): Etiquette[] =>
  [...etiquettesAllergenes(profil.allergenes), ...etiquettesRegimes(profil.regimes)];

/**
 * Ce qui écarte ce plat pour ce profil, en étiquettes : la même règle que `incompatibilites`, dans le même ordre.
 * L'allergène que le plat contient et que le convive ne mange pas, le porc pour un « sans porc », et le régime
 * végétarien quand le plat ne l'est pas. Vide : le plat convient.
 */
export function etiquettesEnCause(profil: ProfilAlimentaire, plat: PlatDeclare): Etiquette[] {
  const enCause = etiquettesAllergenes(plat.allergenes.filter((a) => profil.allergenes.includes(a)));
  if (profil.regimes.includes("sans-porc") && plat.porc) enCause.push(ETIQUETTE_PORC);
  if (profil.regimes.includes("vegetarien") && !plat.vegetarien) enCause.push(...etiquettesRegimes(["vegetarien"]));
  return enCause;
}

/* ── Côté cantine : qui ne pourra pas le prendre ───────────────────────────── */

/** Une cause (« arachide », « sans porc », « végétarien ») et le nombre de convives qu'elle écarte. */
export type Cause = { cause: string; nombre: number };
export type Ecartes = { total: number; causes: Cause[] };

/**
 * Combien de convives ne pourront pas réserver ce plat, et pourquoi : la même règle que pour réserver
 * (`incompatibilites`), passée sur tous les profils. Un convive écarté pour deux causes compte une fois dans le total
 * et une fois dans chaque cause. Les causes vont de la plus fréquente à la plus rare.
 */
export function convivesEcartes(profils: ProfilAlimentaire[], plat: PlatDeclare): Ecartes {
  const parCause = new Map<string, number>();
  let total = 0;
  for (const profil of profils) {
    const causes: string[] = [];
    for (const a of ALLERGENES) if (plat.allergenes.includes(a.id) && profil.allergenes.includes(a.id)) causes.push(a.nom);
    if (profil.regimes.includes("sans-porc") && plat.porc) causes.push("sans porc");
    if (profil.regimes.includes("vegetarien") && !plat.vegetarien) causes.push("végétarien");
    if (causes.length === 0) continue;
    total += 1;
    for (const c of causes) parCause.set(c, (parCause.get(c) ?? 0) + 1);
  }
  const causes = [...parCause].map(([cause, nombre]) => ({ cause, nombre }))
    .sort((a, b) => b.nombre - a.nombre || a.cause.localeCompare(b.cause, "fr"));
  return { total, causes };
}

/** « arachide 3, végétarien 1 » */
export const causesEnMots = (causes: Cause[]) => causes.map((c) => `${c.cause} ${c.nombre.toLocaleString("fr-FR")}`).join(", ");

/* ── Une cause, en étiquette ────────────────────────────────────────────────── */

/**
 * Une cause de `convivesEcartes` (« arachide », « sans porc », « végétarien ») avec son dessin, pour la montrer à côté
 * de son nom et de son nombre. Null pour une cause que la cantine ne connaît pas : l'appelant écrit alors le nom seul.
 */
export const etiquetteDeCause = (cause: string): Etiquette | null =>
  [...etiquettesAllergenes(ALLERGENES.map((a) => a.id)), ...etiquettesRegimes(["sans-porc", "vegetarien"])].find((e) => e.nom === cause) ?? null;
