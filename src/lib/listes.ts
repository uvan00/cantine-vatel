// Allergènes et régimes proposés par la cantine, et les deux fonctions qui rangent une liste dans un texte : SQLite
// ne connaît pas les listes, la base garde « arachide,poisson ». Fonctions pures, testées par `npm test`.

/** `avec` : la forme qui suit « contient » (« contient de l'arachide »). */
export const ALLERGENES = [
  { id: "arachide", nom: "arachide", avec: "de l'arachide" },
  { id: "poisson", nom: "poisson", avec: "du poisson" },
  { id: "crustaces", nom: "crustacés", avec: "des crustacés" },
  { id: "oeuf", nom: "œuf", avec: "de l'œuf" },
  { id: "lait", nom: "lait", avec: "du lait" },
  { id: "gluten", nom: "gluten", avec: "du gluten" },
  { id: "soja", nom: "soja", avec: "du soja" },
  { id: "fruits-a-coque", nom: "fruits à coque", avec: "des fruits à coque" },
  { id: "sesame", nom: "sésame", avec: "du sésame" },
] as const;

export const REGIMES = [
  { id: "sans-porc", nom: "sans porc" },
  { id: "vegetarien", nom: "végétarien" },
] as const;

export const IDS_ALLERGENES: readonly string[] = ALLERGENES.map((a) => a.id);
export const IDS_REGIMES: readonly string[] = REGIMES.map((r) => r.id);

export const nomAllergene = (id: string) => ALLERGENES.find((a) => a.id === id)?.nom ?? id;
export const nomRegime = (id: string) => REGIMES.find((r) => r.id === id)?.nom ?? id;

/** « arachide, poisson » → ["arachide", "poisson"] */
export const lireListe = (texte: string) => texte.split(",").map((v) => v.trim()).filter(Boolean);

/** Garde seulement les valeurs permises, une fois chacune, dans l'ordre de la liste permise. */
export const ecrireListe = (valeurs: string[], permis: readonly string[]) => permis.filter((p) => valeurs.includes(p)).join(",");
