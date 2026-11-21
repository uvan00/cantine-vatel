// Essais du laissez-passer de la borne : `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { DUREE_BORNE_MS, borneValable, signerBorne } from "./borne.ts";

const T0 = Date.UTC(2026, 10, 21, 7, 0);
const SECRET = "un-secret-d-essai";

test("un laissez-passer signé par le serveur passe jusqu'à son heure de fin", () => {
  const jeton = signerBorne(SECRET, T0 + DUREE_BORNE_MS);
  assert.equal(borneValable(jeton, SECRET, T0), true);
  assert.equal(borneValable(jeton, SECRET, T0 + DUREE_BORNE_MS - 1), true);
  assert.equal(borneValable(jeton, SECRET, T0 + DUREE_BORNE_MS), false);
});

test("un laissez-passer trafiqué, signé par un autre secret ou mal formé est refusé", () => {
  const jeton = signerBorne(SECRET, T0 + DUREE_BORNE_MS);
  const [, signe] = jeton.split(".");
  assert.equal(borneValable(`${T0 + 10 * DUREE_BORNE_MS}.${signe}`, SECRET, T0), false);
  assert.equal(borneValable(jeton, "un-autre-secret", T0), false);
  assert.equal(borneValable(signerBorne("un-autre-secret", T0 + DUREE_BORNE_MS), SECRET, T0), false);
  for (const faux of [undefined, null, "", "abc", "123.zz", `${T0 + 1}.${"a".repeat(64)}.x`]) assert.equal(borneValable(faux, SECRET, T0), false);
  assert.equal(borneValable(jeton, "", T0), false);
});
