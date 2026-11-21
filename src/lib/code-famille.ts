// Le code famille : ce que l'élève donne à son parent pour qu'il suive son compte. C'est l'élève qui le crée, dans son
// compte, au moment où il veut relier un parent : le code ne sert qu'une fois et s'éteint au bout de 15 minutes. Avant
// le 21/11/2026, le code était permanent et affiché dans le compte : qui le lisait une fois pouvait se relier pour
// toujours. Règles pures, testées par `npm test`.

/** Le code vit 15 minutes. */
export const DUREE_CODE_MIN = 15;

/** Sous quel nom le code attend, parmi les vérifications gardées en base. */
const PREFIXE = "code-famille:";
export const identifiantCode = (code: string) => `${PREFIXE}${code}`;
export const estUnCodeFamille = (identifiant: string) => identifiant.startsWith(PREFIXE);

export const expirationCode = (maintenant: number) => maintenant + DUREE_CODE_MIN * 60_000;

export type VerdictCode = { ok: true } | { ok: false; phrase: string };

export const CODE_PAS_VALABLE = "Ce code n'est pas valable : demande à ton enfant d'en créer un nouveau dans son compte";

/** Un code ne relie que s'il existe encore et n'a pas dépassé son heure. La même phrase dans les deux cas : on ne dit pas lequel. */
export function codeUtilisable(code: { expire: number } | null, maintenant: number): VerdictCode {
  if (!code || code.expire <= maintenant) return { ok: false, phrase: CODE_PAS_VALABLE };
  return { ok: true };
}
