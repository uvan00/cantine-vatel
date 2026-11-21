import { strict as assert } from "node:assert";
import { test } from "node:test";
import { MOT_DE_PASSE_MAX, NOM_EQUIPE_MAX, refusMotDePasse, refusResponsable } from "./equipe.ts";

const bon = { nom: "Fatou Diabaté", email: "fatou@cantine.test", motDePasse: "comptoir-2026" };

test("un responsable complet se crée", () => {
  assert.equal(refusResponsable(bon), null);
  assert.equal(refusResponsable({ ...bon, nom: "  Fatou Diabaté  ", email: " FATOU@cantine.test " }), null);
});

test("un nom trop court ou trop long est refusé", () => {
  assert.match(refusResponsable({ ...bon, nom: "F" }) ?? "", /2 à/);
  assert.match(refusResponsable({ ...bon, nom: "x".repeat(NOM_EQUIPE_MAX + 1) }) ?? "", /2 à/);
});

test("un e-mail sans arobase ni domaine est refusé", () => {
  for (const email of ["fatou", "fatou@", "fatou@cantine", "fa tou@cantine.test"]) assert.match(refusResponsable({ ...bon, email }) ?? "", /e-mail/, email);
});

test("le mot de passe fait au moins 8 caractères, et pas trop", () => {
  assert.match(refusMotDePasse("court") ?? "", /au moins 8/);
  assert.equal(refusMotDePasse("huit-car"), null);
  assert.match(refusMotDePasse("x".repeat(MOT_DE_PASSE_MAX + 1)) ?? "", /trop long/);
  assert.match(refusResponsable({ ...bon, motDePasse: "1234" }) ?? "", /au moins 8/);
});
