// Essais du profil alimentaire et des listes rangées en texte : `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { IDS_ALLERGENES, IDS_REGIMES, ecrireListe, lireListe, nomAllergene } from "./listes.ts";
import { incompatibilites, phraseIncompatibilites } from "./profil-alimentaire.ts";

const plat = (p: Partial<{ allergenes: string[]; porc: boolean; vegetarien: boolean }> = {}) =>
  ({ allergenes: [], porc: false, vegetarien: false, ...p });

test("une liste se range en texte et se relit", () => {
  assert.deepEqual(lireListe("arachide,poisson"), ["arachide", "poisson"]);
  assert.deepEqual(lireListe(""), []);
  assert.deepEqual(lireListe(" arachide , ,lait "), ["arachide", "lait"]);
  assert.equal(ecrireListe(["poisson", "arachide"], IDS_ALLERGENES), "arachide,poisson");
});

test("écrire une liste écarte les valeurs inconnues et les doublons", () => {
  assert.equal(ecrireListe(["arachide", "arachide", "cailloux"], IDS_ALLERGENES), "arachide");
  assert.equal(ecrireListe(["vegetarien", "sans-gluten"], IDS_REGIMES), "vegetarien");
  assert.equal(nomAllergene("fruits-a-coque"), "fruits à coque");
});

test("un plat sans rien de déclaré convient à tout le monde, sauf au végétarien", () => {
  assert.deepEqual(incompatibilites({ allergenes: ["arachide", "lait"], regimes: ["sans-porc"] }, plat()), []);
  assert.deepEqual(incompatibilites({ allergenes: [], regimes: ["vegetarien"] }, plat()), ["n'est pas végétarien"]);
});

test("une allergie bloque le plat qui déclare cet allergène", () => {
  const awa = { allergenes: ["arachide"], regimes: [] };
  assert.deepEqual(incompatibilites(awa, plat({ allergenes: ["arachide"] })), ["contient de l'arachide"]);
  assert.deepEqual(incompatibilites(awa, plat({ allergenes: ["poisson"] })), []);
});

test("les régimes : sans porc et végétarien", () => {
  assert.deepEqual(incompatibilites({ allergenes: [], regimes: ["sans-porc"] }, plat({ porc: true })), ["contient du porc"]);
  assert.deepEqual(incompatibilites({ allergenes: [], regimes: ["vegetarien"] }, plat({ vegetarien: true })), []);
});

test("plusieurs raisons se disent en une phrase", () => {
  const raisons = incompatibilites({ allergenes: ["poisson", "crustaces"], regimes: ["vegetarien"] }, plat({ allergenes: ["crustaces", "poisson"] }));
  assert.deepEqual(raisons, ["contient du poisson", "contient des crustacés", "n'est pas végétarien"]);
  assert.equal(phraseIncompatibilites(raisons), "Ce plat contient du poisson, contient des crustacés et n'est pas végétarien");
});
