// Essais des règles de recharge : `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { PISPI_ACTIF, moyenManuel, proposerQrUniversel } from "./recharge.ts";

test("le QR universel PI-SPI est coupé pour le moment (demande du 21/11/2026)", () => {
  assert.equal(PISPI_ACTIF, false);
  assert.equal(proposerQrUniversel("en_attente"), false);
});

test("une fois rétabli, le QR ne s'offre que tant que la recharge attend son paiement", () => {
  assert.equal(proposerQrUniversel("en_attente", true), true);
  assert.equal(proposerQrUniversel("confirmee", true), false);
  assert.equal(proposerQrUniversel("annulee", true), false);
});

test("tant que le QR est coupé, une recharge confirmée à la main compte en espèces", () => {
  assert.equal(moyenManuel(), "especes");
  assert.equal(moyenManuel(false), "especes");
  assert.equal(moyenManuel(true), "pispi");
});
