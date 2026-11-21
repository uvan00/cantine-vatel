// Essais du code famille à usage unique : `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DUREE_CODE_MIN, codeUtilisable, estUnCodeFamille, expirationCode, identifiantCode } from "./code-famille.ts";

const T0 = Date.UTC(2026, 10, 21, 12, 0);

test("le code vit 15 minutes, pas une de plus", () => {
  const expire = expirationCode(T0);
  assert.equal(expire - T0, DUREE_CODE_MIN * 60_000);
  assert.deepEqual(codeUtilisable({ expire }, T0 + 14 * 60_000), { ok: true });
  assert.equal(codeUtilisable({ expire }, expire).ok, false);
  assert.equal(codeUtilisable({ expire }, expire + 1).ok, false);
});

test("un code inconnu et un code périmé reçoivent la même phrase", () => {
  const inconnu = codeUtilisable(null, T0);
  const perime = codeUtilisable({ expire: T0 - 1 }, T0);
  assert.equal(inconnu.ok, false);
  assert.deepEqual(inconnu, perime);
});

test("le code attend sous un nom à lui parmi les vérifications", () => {
  assert.equal(identifiantCode("K7M2QX"), "code-famille:K7M2QX");
  assert.equal(estUnCodeFamille("code-famille:K7M2QX"), true);
  assert.equal(estUnCodeFamille("awa@cantine.test"), false);
});
