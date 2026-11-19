// Chercher un convive par son nom, au comptoir : sans tenir compte des majuscules, des accents ni des apostrophes
// (« aicha » trouve « Aïcha », « nguessan » trouve « N'Guessan »). Fonctions pures, testées par `npm test`.

/** Le texte ramené à des minuscules sans accent, les mots séparés par une espace. */
export const simplifier = (texte: string) =>
  texte.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/['\u2019]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Le rang d'un nom pour une recherche : 0 si chaque mot tapé commence un mot du nom, 1 s'il s'y trouve seulement,
 * null si le nom ne correspond pas (ou si rien n'est tapé).
 */
export function rang(nom: string, recherche: string): 0 | 1 | null {
  const tapes = simplifier(recherche).split(" ").filter(Boolean);
  if (tapes.length === 0) return null;
  const cible = simplifier(nom);
  if (!tapes.every((t) => cible.includes(t))) return null;
  const mots = cible.split(" ");
  return tapes.every((t) => mots.some((m) => m.startsWith(t))) ? 0 : 1;
}

/** Les noms qui correspondent : ceux dont un mot commence par ce qui est tapé d'abord, puis par ordre alphabétique. */
export function chercher<T extends { nom: string }>(liste: T[], recherche: string, limite: number): T[] {
  return liste
    .flatMap((element) => { const r = rang(element.nom, recherche); return r === null ? [] : [{ element, r }]; })
    .sort((a, b) => a.r - b.r || a.element.nom.localeCompare(b.element.nom, "fr"))
    .slice(0, limite)
    .map((x) => x.element);
}
