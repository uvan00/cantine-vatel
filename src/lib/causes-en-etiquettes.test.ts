// Les causes de « Pas pour 3 convives » en étiquettes (un dessin et un nom), côté cantine.
import assert from "node:assert/strict";
import { test } from "node:test";
import { ALLERGENES } from "./listes.ts";
import { convivesEcartes, etiquetteDeCause } from "./profil-alimentaire.ts";

test("chaque allergène et chaque régime, nommé comme une cause, retrouve son dessin", () => {
  for (const a of ALLERGENES) assert.deepEqual(etiquetteDeCause(a.nom), { id: a.id, nom: a.nom, image: a.image });
  assert.deepEqual(etiquetteDeCause("sans porc"), { id: "sans-porc", nom: "sans porc", image: "/allergenes/porc.webp" });
  assert.deepEqual(etiquetteDeCause("végétarien"), { id: "vegetarien", nom: "végétarien", image: "/allergenes/vegetarien.webp" });
});

test("une cause inconnue n'a pas d'étiquette", () => {
  assert.equal(etiquetteDeCause("piment"), null);
  assert.equal(etiquetteDeCause(""), null);
});

test("toutes les causes que rend convivesEcartes ont une étiquette", () => {
  const profils = [
    { allergenes: ALLERGENES.map((a) => a.id), regimes: [] },
    { allergenes: [], regimes: ["sans-porc"] },
    { allergenes: [], regimes: ["vegetarien"] },
  ];
  const { causes } = convivesEcartes(profils, { allergenes: ALLERGENES.map((a) => a.id), porc: true, vegetarien: false });
  assert.equal(causes.length, 16);
  for (const c of causes) assert.notEqual(etiquetteDeCause(c.cause), null, c.cause);
});
