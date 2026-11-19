// Le profil alimentaire : ce qu'un convive ne mange pas, face à ce qu'un plat déclare. Une seule fonction décide si
// un plat convient. L'application répète ce que la cantine a déclaré : elle ne garantit pas la composition d'un plat.
// Fonctions pures, testées par `npm test`.
import { ALLERGENES } from "./listes.ts";
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
