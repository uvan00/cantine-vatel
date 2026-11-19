// Essais des bornes d'un plat, d'un menu du jour et des notes : `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { moyenne, noteValable, peutRetirer, portionsValables, prixValable } from "./menu.ts";

test("un prix est un entier de 100 à 50 000 francs", () => {
  assert.equal(prixValable(100), true);
  assert.equal(prixValable(1500), true);
  assert.equal(prixValable(50_000), true);
  assert.equal(prixValable(99), false);
  assert.equal(prixValable(50_001), false);
  assert.equal(prixValable(1500.5), false);
  assert.equal(prixValable(Number.NaN), false);
});

test("les portions prévues : vide, ou un entier de 1 à 5 000", () => {
  assert.equal(portionsValables(null), true);
  assert.equal(portionsValables(40), true);
  assert.equal(portionsValables(0), false);
  assert.equal(portionsValables(5001), false);
  assert.equal(portionsValables(12.5), false);
});

test("un plat déjà réservé ne se retire pas du menu", () => {
  assert.equal(peutRetirer(0), true);
  assert.equal(peutRetirer(1), false);
});

test("une note va de 1 à 5, et la moyenne s'arrondit au dixième", () => {
  assert.equal(noteValable(1), true);
  assert.equal(noteValable(5), true);
  assert.equal(noteValable(0), false);
  assert.equal(noteValable(6), false);
  assert.equal(noteValable(4.5), false);
  assert.equal(moyenne([]), null);
  assert.equal(moyenne([5, 4, 4]), 4.3);
  assert.equal(moyenne([3]), 3);
});
