// Essais du profil alimentaire et des listes rangées en texte : `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { IDS_ALLERGENES, IDS_REGIMES, ecrireListe, lireListe, nomAllergene } from "./listes.ts";
import { causesEnMots, convivesEcartes, incompatibilites, phraseIncompatibilites } from "./profil-alimentaire.ts";

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

test("la cantine voit combien de convives ne pourront pas prendre un plat, et pourquoi", () => {
  const profils = [
    { allergenes: ["arachide"], regimes: [] },
    { allergenes: ["arachide"], regimes: ["vegetarien"] },
    { allergenes: [], regimes: ["vegetarien"] },
    { allergenes: ["arachide"], regimes: [] },
    { allergenes: [], regimes: ["sans-porc"] },
    { allergenes: [], regimes: [] },
  ];
  const sauce = { allergenes: ["arachide"], porc: false, vegetarien: false };
  const e = convivesEcartes(profils, sauce);
  // Le deuxième convive a deux causes : il compte une fois dans le total, une fois dans chaque cause.
  assert.equal(e.total, 4);
  assert.deepEqual(e.causes, [{ cause: "arachide", nombre: 3 }, { cause: "végétarien", nombre: 2 }]);
  assert.equal(causesEnMots(e.causes), "arachide 3, végétarien 2");
});

test("un plat qui convient à tous n'écarte personne", () => {
  const profils = [{ allergenes: ["poisson"], regimes: ["sans-porc"] }, { allergenes: [], regimes: [] }];
  assert.deepEqual(convivesEcartes(profils, { allergenes: [], porc: false, vegetarien: true }), { total: 0, causes: [] });
  assert.deepEqual(convivesEcartes([], { allergenes: ["arachide"], porc: true, vegetarien: false }), { total: 0, causes: [] });
});

test("le porc écarte ceux qui n'en mangent pas, avec la même règle que pour réserver", () => {
  const profils = [{ allergenes: [], regimes: ["sans-porc"] }, { allergenes: [], regimes: ["sans-porc", "vegetarien"] }];
  const plat = { allergenes: [], porc: true, vegetarien: false };
  const e = convivesEcartes(profils, plat);
  assert.equal(e.total, profils.filter((p) => incompatibilites(p, plat).length > 0).length);
  assert.deepEqual(e.causes, [{ cause: "sans porc", nombre: 2 }, { cause: "végétarien", nombre: 1 }]);
});
