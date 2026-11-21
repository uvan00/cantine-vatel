// Les allergènes et leurs dessins : la liste, les étiquettes (un dessin et un nom), et ce qui écarte un plat.
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { ALLERGENES, ETIQUETTE_PORC, IDS_ALLERGENES, REGIMES, etiquettesAllergenes, etiquettesRegimes } from "./listes.ts";
import { etiquettesDuPlat, etiquettesDuProfil, etiquettesEnCause, incompatibilites } from "./profil-alimentaire.ts";

const fichier = (image: string) => new URL(`../../public${image}`, import.meta.url);

test("la cantine propose les quatorze allergènes de la réglementation, une fois chacun", () => {
  assert.equal(ALLERGENES.length, 14);
  assert.equal(new Set(IDS_ALLERGENES).size, 14);
  for (const id of ["celeri", "moutarde", "sulfites", "lupin", "mollusques"]) assert.ok(IDS_ALLERGENES.includes(id), id);
});

test("les neuf allergènes d'avant gardent leur identifiant : les profils et les plats déjà en base restent lus", () => {
  assert.deepEqual(IDS_ALLERGENES.slice(0, 9), ["arachide", "poisson", "crustaces", "oeuf", "lait", "gluten", "soja", "fruits-a-coque", "sesame"]);
});

test("chaque allergène et chaque régime a son dessin dans public/allergenes", () => {
  for (const e of [...ALLERGENES, ...REGIMES, ETIQUETTE_PORC]) {
    assert.match(e.image, /^\/allergenes\/[a-z-]+\.webp$/);
    assert.ok(existsSync(fichier(e.image)), `dessin absent : ${e.image}`);
  }
});

test("les étiquettes suivent l'ordre de la liste de la cantine et ignorent un identifiant inconnu", () => {
  assert.deepEqual(etiquettesAllergenes(["lait", "chocolat", "arachide"]).map((e) => e.nom), ["arachide", "lait"]);
  assert.deepEqual(etiquettesRegimes(["vegetarien", "sans-porc"]).map((e) => e.nom), ["sans porc", "végétarien"]);
});

test("un plat s'étiquette avec ses allergènes puis le porc, un profil avec ses allergènes puis ses régimes", () => {
  assert.deepEqual(etiquettesDuPlat({ allergenes: ["poisson", "moutarde"], porc: true, vegetarien: false }).map((e) => e.nom), ["poisson", "moutarde", "porc"]);
  assert.deepEqual(etiquettesDuPlat({ allergenes: [], porc: false, vegetarien: true }), []);
  assert.deepEqual(etiquettesDuProfil({ allergenes: ["arachide"], regimes: ["sans-porc"] }).map((e) => e.nom), ["arachide", "sans porc"]);
});

test("ce qui écarte un plat : l'allergène commun, le porc pour un « sans porc », le régime végétarien", () => {
  const sauceArachide = { allergenes: ["arachide", "poisson"], porc: false, vegetarien: false };
  assert.deepEqual(etiquettesEnCause({ allergenes: ["arachide", "lait"], regimes: [] }, sauceArachide).map((e) => e.id), ["arachide"]);
  assert.deepEqual(etiquettesEnCause({ allergenes: [], regimes: ["sans-porc"] }, { allergenes: [], porc: true, vegetarien: false }).map((e) => e.id), ["porc"]);
  assert.deepEqual(etiquettesEnCause({ allergenes: [], regimes: ["vegetarien"] }, sauceArachide).map((e) => e.id), ["vegetarien"]);
  assert.deepEqual(etiquettesEnCause({ allergenes: ["lait"], regimes: ["sans-porc"] }, sauceArachide), []);
});

test("les étiquettes en cause et les raisons en mots disent la même chose, autant de fois", () => {
  const profil = { allergenes: ["arachide", "moutarde"], regimes: ["sans-porc", "vegetarien"] };
  const plat = { allergenes: ["moutarde", "arachide", "celeri"], porc: true, vegetarien: false };
  assert.equal(etiquettesEnCause(profil, plat).length, incompatibilites(profil, plat).length);
  assert.deepEqual(incompatibilites(profil, plat), ["contient de l'arachide", "contient de la moutarde", "contient du porc", "n'est pas végétarien"]);
});
