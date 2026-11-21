// Essais des réglages de la cantine. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { REGLAGES_DEFAUT, erreurReglages, heuresDePassage } from "./reglages.ts";

test("les réglages par défaut sont bons : clôture à 9 h, pas de créneaux", () => {
  assert.equal(erreurReglages(REGLAGES_DEFAUT), null);
  assert.deepEqual(heuresDePassage(REGLAGES_DEFAUT), []);
});

test("les créneaux ouverts donnent les heures de passage du service", () => {
  assert.deepEqual(heuresDePassage({ ...REGLAGES_DEFAUT, creneauxActifs: true, creneauDebut: "12:00", creneauFin: "12:30" }), ["12:00", "12:15"]);
});

test("des réglages faux sont refusés, avec leur raison", () => {
  assert.match(erreurReglages({ ...REGLAGES_DEFAUT, heureCloture: 14 }) ?? "", /clôture/);
  assert.match(erreurReglages({ ...REGLAGES_DEFAUT, creneauMinutes: 7 }) ?? "", /minutes/);
  assert.match(erreurReglages({ ...REGLAGES_DEFAUT, creneauDebut: "13:00", creneauFin: "12:00" }) ?? "", /finit/);
  assert.match(erreurReglages({ ...REGLAGES_DEFAUT, creneauCapacite: 0 }) ?? "", /passages/);
  assert.match(erreurReglages({ ...REGLAGES_DEFAUT, remiseReduit: 120 }) ?? "", /remise/);
});
