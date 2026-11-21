// Essais des créneaux de passage. `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { creneauLisible, creneauxEntre, etatsCreneaux, heureValable, verdictCreneau } from "./creneaux.ts";

test("les heures de passage, de la première comprise à la fin exclue", () => {
  assert.deepEqual(creneauxEntre("11:45", "12:45", 15), ["11:45", "12:00", "12:15", "12:30"]);
  assert.deepEqual(creneauxEntre("12:00", "12:00", 15), []);
  assert.deepEqual(creneauxEntre("12:00", "11:00", 15), []);
  assert.deepEqual(creneauxEntre("12:00", "13:00", 3), [], "un pas de moins de 5 minutes est refusé");
  assert.deepEqual(creneauxEntre("midi", "13:00", 15), []);
  assert.equal(creneauxEntre("00:00", "23:59", 5).length, 48, "48 créneaux au plus");
});

test("une heure s'écrit sur 5 caractères et se lit en français", () => {
  assert.equal(heureValable("09:05"), true);
  assert.equal(heureValable("24:00"), false);
  assert.equal(heureValable("9:05"), false);
  assert.equal(creneauLisible("12:15"), "12 h 15");
  assert.equal(creneauLisible("12:00"), "12 h");
});

test("places prises et libres de chaque créneau", () => {
  assert.deepEqual(etatsCreneaux(["12:00", "12:15"], { "12:00": 40 }, 40), [
    { heure: "12:00", pris: 40, libres: 0, complet: true },
    { heure: "12:15", pris: 0, libres: 40, complet: false },
  ]);
});

test("le créneau d'une réservation : rien à choisir sans créneaux, sinon une heure du service qui a de la place", () => {
  const heures = ["12:00", "12:15"];
  assert.deepEqual(verdictCreneau({ actifs: false, choisi: null, heures, pris: 0, capacite: 10 }), { ok: true });
  assert.equal(verdictCreneau({ actifs: true, choisi: null, heures, pris: 0, capacite: 10 }).ok, false);
  assert.equal(verdictCreneau({ actifs: true, choisi: "13:00", heures, pris: 0, capacite: 10 }).ok, false);
  const plein = verdictCreneau({ actifs: true, choisi: "12:15", heures, pris: 10, capacite: 10 });
  assert.equal(plein.ok, false);
  assert.match(plein.ok ? "" : plein.phrase, /12 h 15 est complet/);
  assert.deepEqual(verdictCreneau({ actifs: true, choisi: "12:15", heures, pris: 9, capacite: 10 }), { ok: true });
});
