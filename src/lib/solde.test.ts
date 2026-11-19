// Essais de l'argent : `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { manque, mouvementRecharge, mouvementRemboursement, mouvementRepas, seuilValable, soldeBas, soldeDe } from "./solde.ts";

test("le solde est la somme du journal", () => {
  assert.equal(soldeDe([]), 0);
  const journal = [mouvementRecharge(5000), mouvementRepas(1500), mouvementRepas(1000)];
  assert.equal(soldeDe(journal), 2500);
});

test("annuler rend exactement ce que le repas a pris", () => {
  const journal = [mouvementRecharge(5000), mouvementRepas(1500), mouvementRemboursement(1500)];
  assert.equal(soldeDe(journal), 5000);
});

test("un repas retire, une recharge et un remboursement ajoutent", () => {
  assert.deepEqual(mouvementRepas(1500), { genre: "repas", montant: -1500 });
  assert.deepEqual(mouvementRecharge(5000), { genre: "recharge", montant: 5000 });
  assert.deepEqual(mouvementRemboursement(1500), { genre: "remboursement", montant: 1500 });
});

test("un montant est un entier de francs plus grand que zéro", () => {
  assert.throws(() => mouvementRepas(0));
  assert.throws(() => mouvementRecharge(-500));
  assert.throws(() => mouvementRemboursement(12.5));
  assert.throws(() => mouvementRecharge(Number.NaN));
});

test("ce qu'il manque pour un plat", () => {
  assert.equal(manque(1000, 1500), 500);
  assert.equal(manque(1500, 1500), 0);
  assert.equal(manque(4000, 1500), 0);
});

test("le solde est bas strictement sous le seuil", () => {
  assert.equal(soldeBas(1999, 2000), true);
  assert.equal(soldeBas(2000, 2000), false);
  assert.equal(soldeBas(0, 0), false);
});

test("un seuil d'alerte est un entier de 0 à 50 000", () => {
  assert.equal(seuilValable(0), true);
  assert.equal(seuilValable(2000), true);
  assert.equal(seuilValable(50_000), true);
  assert.equal(seuilValable(50_001), false);
  assert.equal(seuilValable(-1), false);
  assert.equal(seuilValable(1500.5), false);
});
