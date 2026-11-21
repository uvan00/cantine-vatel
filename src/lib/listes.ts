// Allergènes et régimes proposés par la cantine, et les deux fonctions qui rangent une liste dans un texte : SQLite
// ne connaît pas les listes, la base garde « arachide,poisson ». Fonctions pures, testées par `npm test`.
//
// Les quatorze allergènes sont ceux que la réglementation européenne fait déclarer (règlement (UE) n° 1169/2011,
// annexe II). Chacun a son dessin dans public/allergenes (découpés par scripts/allergenes.mjs) : partout où un
// allergène ou un régime est nommé, son image est à côté de son nom, jamais seule.

/** `avec` : la forme qui suit « contient » (« contient de l'arachide »). `image` : son dessin. */
export const ALLERGENES = [
  { id: "arachide", nom: "arachide", avec: "de l'arachide", image: "/allergenes/arachide.webp" },
  { id: "poisson", nom: "poisson", avec: "du poisson", image: "/allergenes/poisson.webp" },
  { id: "crustaces", nom: "crustacés", avec: "des crustacés", image: "/allergenes/crustaces.webp" },
  { id: "oeuf", nom: "œuf", avec: "de l'œuf", image: "/allergenes/oeuf.webp" },
  { id: "lait", nom: "lait", avec: "du lait", image: "/allergenes/lait.webp" },
  { id: "gluten", nom: "gluten", avec: "du gluten", image: "/allergenes/gluten.webp" },
  { id: "soja", nom: "soja", avec: "du soja", image: "/allergenes/soja.webp" },
  { id: "fruits-a-coque", nom: "fruits à coque", avec: "des fruits à coque", image: "/allergenes/fruits-a-coque.webp" },
  { id: "sesame", nom: "sésame", avec: "du sésame", image: "/allergenes/sesame.webp" },
  { id: "celeri", nom: "céleri", avec: "du céleri", image: "/allergenes/celeri.webp" },
  { id: "moutarde", nom: "moutarde", avec: "de la moutarde", image: "/allergenes/moutarde.webp" },
  { id: "sulfites", nom: "sulfites", avec: "des sulfites", image: "/allergenes/sulfites.webp" },
  { id: "lupin", nom: "lupin", avec: "du lupin", image: "/allergenes/lupin.webp" },
  { id: "mollusques", nom: "mollusques", avec: "des mollusques", image: "/allergenes/mollusques.webp" },
] as const;

export const REGIMES = [
  { id: "sans-porc", nom: "sans porc", image: "/allergenes/porc.webp" },
  { id: "vegetarien", nom: "végétarien", image: "/allergenes/vegetarien.webp" },
] as const;

export const IDS_ALLERGENES: readonly string[] = ALLERGENES.map((a) => a.id);
export const IDS_REGIMES: readonly string[] = REGIMES.map((r) => r.id);

export const nomAllergene = (id: string) => ALLERGENES.find((a) => a.id === id)?.nom ?? id;
export const nomRegime = (id: string) => REGIMES.find((r) => r.id === id)?.nom ?? id;

/** Ce qui s'affiche partout où un allergène ou un régime est nommé : son dessin et son nom, toujours ensemble. */
export type Etiquette = { id: string; nom: string; image: string };

/** Le porc, tel qu'un plat le déclare (« contient du porc ») : le même dessin que le régime « sans porc ». */
export const ETIQUETTE_PORC: Etiquette = { id: "porc", nom: "porc", image: "/allergenes/porc.webp" };

/** Les étiquettes de ces allergènes, dans l'ordre de la liste de la cantine. Un identifiant inconnu est ignoré. */
export const etiquettesAllergenes = (ids: readonly string[]): Etiquette[] =>
  ALLERGENES.filter((a) => ids.includes(a.id)).map(({ id, nom, image }) => ({ id, nom, image }));

/** Les étiquettes de ces régimes, dans l'ordre de la liste de la cantine. Un identifiant inconnu est ignoré. */
export const etiquettesRegimes = (ids: readonly string[]): Etiquette[] =>
  REGIMES.filter((r) => ids.includes(r.id)).map(({ id, nom, image }) => ({ id, nom, image }));

/** « arachide, poisson » → ["arachide", "poisson"] */
export const lireListe = (texte: string) => texte.split(",").map((v) => v.trim()).filter(Boolean);

/** Garde seulement les valeurs permises, une fois chacune, dans l'ordre de la liste permise. */
export const ecrireListe = (valeurs: string[], permis: readonly string[]) => permis.filter((p) => valeurs.includes(p)).join(",");
